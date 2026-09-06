"""Build local sources in isolation and atomically activate a complete release (Linux)."""

import ctypes
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
from uuid import uuid4


class DeployError(Exception):
    pass


def run(args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(directory):
    result = {}
    for file in sorted(directory.rglob('*')):
        if file.is_symlink():
            raise DeployError(f'Symlinks are not allowed in public/build output: {file}')
        if file.is_file():
            result[file.relative_to(directory).as_posix()] = digest(file)
    return result


def snapshot(source, destination):
    if not (source / 'package-lock.json').is_file():
        raise DeployError(f'Missing package-lock.json in {source}; deploy requires locked dependencies')
    destination.mkdir(parents=True)
    run(['rsync', '-a', '--exclude=.git', '--exclude=node_modules', '--exclude=dist',
         '--exclude=dist-ssr', '--exclude=/build', '--exclude=.angular', '--exclude=.cache',
         '--exclude=*.tsbuildinfo', '--exclude=__pycache__',
         '--', f'{source}/', f'{destination}/'])
    # Never follow a captured symlink back into a live source/dependency directory.
    for file in destination.rglob('*'):
        if file.is_symlink():
            raise DeployError(f'Captured source contains a symlink: {file.relative_to(destination)}')


def move_public(source, output):
    """Move within the private workspace: APKs are copied from live sources only once."""
    output.mkdir(exist_ok=True)
    for item in source.iterdir():
        target = output / item.name
        if item.is_dir() and target.is_dir():
            move_public(item, target)
            item.rmdir()
        else:
            os.replace(item, target)


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'script' and attrs.get('src'):
            self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('href') and attrs.get('rel') in (
            'stylesheet', 'modulepreload', 'preload', 'icon', 'manifest'
        ):
            self.urls.append(attrs['href'])


def validate_output(output, public_files):
    index = output / 'index.html'
    if not index.is_file() or not index.stat().st_size:
        raise DeployError('Missing or empty dist/index.html')
    parser = ResourceParser()
    parser.feed(index.read_text())
    if not parser.urls or not any(output.rglob('*.js')):
        raise DeployError('Build has no JavaScript assets')
    for url in parser.urls:
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or not parts.path:
            continue
        file = (output / unquote(parts.path).lstrip('/')).resolve()
        if not file.is_relative_to(output.resolve()) or not file.is_file():
            raise DeployError(f'Missing build resource: {url}')
    actual = inventory(output)
    for name, checksum in public_files.items():
        if actual.get(name) != checksum:
            raise DeployError(f'Public file missing or changed in build: {name}')
    if not (output / 'web.config').is_file():
        raise DeployError('Missing dist/web.config')
    return actual


def retain_previous_assets(previous, output):
    """Allow existing browser tabs to load chunks from the preceding release."""
    if not previous or not previous.is_dir():
        return
    metadata = previous / 'deploy-info.json'
    names = (json.loads(metadata.read_text())['assets'] if metadata.is_file()
             else [p.relative_to(previous).as_posix() for p in previous.rglob('*')
                   if p.is_file() and p.suffix in ('.js', '.css', '.woff', '.woff2')])
    for name in names:
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise DeployError('Invalid previous asset path')
        source, target = previous / name, output / name
        if source.is_file() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            os.link(source, target)


def activate(web_root, release, releases):
    """Keep WEB_ROOT stable, including the initial real-directory -> symlink migration."""
    link = web_root.parent / f'.activate-{uuid4().hex}'
    link.symlink_to(release)
    try:
        if web_root.is_symlink() or not web_root.exists():
            os.replace(link, web_root)
            return
        if not web_root.is_dir():
            raise DeployError(f'WEB_ROOT is not a directory: {web_root}')
        # Linux renameat2 exchanges a nonempty directory and a symlink without a gap.
        libc = ctypes.CDLL(None, use_errno=True)
        exchange = getattr(libc, 'renameat2', None)
        if exchange is None:
            raise DeployError('renameat2 is required to migrate the existing production directory')
        exchange.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
        exchange.restype = ctypes.c_int
        if exchange(-100, os.fsencode(link), -100, os.fsencode(web_root), 2) != 0:
            raise OSError(ctypes.get_errno(), 'Atomic production directory migration failed')
        # At this point publication has succeeded; failure to rename the backup is nonfatal.
        backup = releases / f'legacy-{uuid4().hex}'
        try:
            os.rename(link, backup)
            print(f'Previous production directory preserved at {backup}', flush=True)
        except OSError as error:
            print(f'WARNING: previous production preserved at {link}: {error}', file=sys.stderr)
    finally:
        if link.is_symlink():
            link.unlink()


def prune_releases(releases, active, keep):
    owned = sorted((p for p in releases.glob('release-*')
                    if p.is_dir() and not p.is_symlink() and (p / 'deploy-info.json').is_file()),
                   key=lambda p: p.name, reverse=True)
    retained = {active, *owned[:keep]}
    for release in owned:
        if release not in retained:
            shutil.rmtree(release)


def deploy(root):
    config = json.loads((root / 'deploy.config.json').read_text())
    source_subdir = Path(config.get('sourceSubdir', '.'))
    output_dir = Path(config.get('outputDir', 'dist'))
    for relative in (source_subdir, output_dir):
        if relative.is_absolute() or '..' in relative.parts:
            raise DeployError('sourceSubdir/outputDir must stay within the captured project')
    source_root = root / source_subdir
    web_root = Path(os.environ.get('WEB_ROOT', config.get('webRoot', f'/var/www/{root.name}/dist'))).absolute()
    # Resolve the parent only: resolving WEB_ROOT itself would follow the active release.
    web_root = web_root.parent.resolve() / web_root.name
    if web_root.is_relative_to(root) or root.is_relative_to(web_root):
        raise DeployError('WEB_ROOT must be outside the working project')
    web_root.parent.mkdir(parents=True, exist_ok=True)
    with (web_root.parent / f'.{web_root.name}.deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError('Another deploy is already running for this destination')
        releases = web_root.parent / f'{web_root.name}-releases'
        releases.mkdir(mode=0o755, exist_ok=True)
        previous = web_root.resolve() if web_root.exists() else None
        release = releases / ('release-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid4().hex[:8])
        try:
            with tempfile.TemporaryDirectory(prefix='.build-', dir=web_root.parent) as temp:
                workspace = Path(temp)
                client = workspace / root.name / source_subdir
                projects = [(source_root, client)]
                for name in config.get('localProjects', []):
                    if name != Path(name).name or name in ('.', '..', root.name):
                        raise DeployError(f'Invalid local project: {name}')
                    projects.append((root.parent / name, workspace / name))
                for source, captured in projects:
                    print(f'Capturing local sources: {source.name}', flush=True)
                    snapshot(source, captured)
                public = client / 'public'
                # Framework templates (CRA index.html) are transformed by the build.
                public.mkdir(exist_ok=True)
                for name in config.get('excludePublic', []):
                    if Path(name).is_absolute() or '..' in Path(name).parts:
                        raise DeployError('Invalid public exclusion')
                    excluded = public / name
                    if excluded.is_dir():
                        shutil.rmtree(excluded)
                    elif excluded.exists():
                        excluded.unlink()
                public_files = inventory(public)
                for name in config.get('publicTemplates', []):
                    public_files.pop(name, None)
                for pattern in config.get('requiredPublic', []):
                    if not any(p.is_file() for p in public.glob(pattern)):
                        raise DeployError(f'Required local public files missing: {pattern}')
                env = os.environ.copy()
                # npm lifecycle scripts may inherit npm_config_* from `npm run deploy`.
                for key in list(env):
                    if key.lower() in ('npm_config_omit', 'npm_config_production', 'npm_config_only'):
                        env.pop(key)
                env.update(NODE_ENV='production', CLIENT_ISOLATED_DEPLOY='1',
                           EDALXGOAM_COMPONENTS_SRC=str(workspace / 'edalxgoam_components' / 'src'))
                for _, captured in projects:
                    print(f'Installing locked dependencies: {captured.name}', flush=True)
                    run(['npm', 'ci', '--include=dev', '--no-audit', '--no-fund'], cwd=captured, env=env)
                print('Building client and imported shared components', flush=True)
                run(['npm', 'run', 'build'], cwd=client, env=env)
                output = client / output_dir
                if config.get('publicMode', 'move') == 'move':
                    move_public(public, output)
                elif config['publicMode'] != 'native':
                    raise DeployError('publicMode must be move or native')
                generated = validate_output(output, public_files)
                assets = [name for name in generated if name not in public_files
                          and Path(name).suffix in ('.js', '.css', '.woff', '.woff2')]
                print(f'Validated {len(generated)} files, including {sum(n.endswith(".apk") for n in public_files)} APKs', flush=True)
                metadata = {
                    'release': release.name,
                    'createdAt': datetime.now(timezone.utc).isoformat(),
                    'projects': {p.name: {'lockSha256': digest(p / 'package-lock.json')}
                                 for _, p in projects},
                    'assets': assets,
                    'publicSha256': public_files,
                }
                (output / 'deploy-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
                retain_previous_assets(previous, output)
                # Output is static public content; the temporary workspace stays private.
                for file in output.rglob('*'):
                    file.chmod(0o755 if file.is_dir() else 0o644)
                output.chmod(0o755)
                os.rename(output, release)
                activate(web_root, release, releases)
            print(f'Deployed to {web_root} -> {release.name}. Dev mode and PM2 unchanged.', flush=True)
            try:
                prune_releases(releases, release, max(2, config.get('keepReleases', 2)))
            except OSError as error:
                print(f'WARNING: old release cleanup failed: {error}', file=sys.stderr)
        except BaseException:
            # Never remove a release that has already been activated.
            if release.exists() and web_root.resolve() != release:
                shutil.rmtree(release)
            raise


def main():
    def interrupted(signum, _frame):
        raise DeployError(f'Deploy interrupted by signal {signum}')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        deploy(Path(__file__).resolve().parent.parent)
    except (DeployError, OSError, subprocess.CalledProcessError) as error:
        print(f'Deploy failed: {error}', file=sys.stderr, flush=True)
        return error.returncode if isinstance(error, subprocess.CalledProcessError) else 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
