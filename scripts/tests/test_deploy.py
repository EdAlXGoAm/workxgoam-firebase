"""Exercise the deploy lifecycle with real rsync/filesystem operations and a fake build."""

import fcntl
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'deploy.py'
spec = importlib.util.spec_from_file_location('deploy', SCRIPT)
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)

FAKE_NPM = '''#!/usr/bin/env python3
import json, os, pathlib, sys, time
root = pathlib.Path.cwd()
with open(os.environ['CALL_LOG'], 'a') as log:
    log.write(json.dumps({'cwd': str(root), 'args': sys.argv[1:]}) + '\\n')
if os.environ.get('FAIL_INSTALL') and sys.argv[1] == 'ci':
    sys.exit(17)
if sys.argv[1] == 'ci':
    (root / 'node_modules').mkdir(exist_ok=True)
    (root / 'node_modules/installed-by-test').write_text('captured only')
else:
    assert os.environ['CLIENT_ISOLATED_DEPLOY'] == '1'
    sibling = pathlib.Path(os.environ['EDALXGOAM_COMPONENTS_SRC'])
    assert sibling == root.parent / 'edalxgoam_components/src'
    assert (sibling.parent / 'node_modules/installed-by-test').is_file()
    assert (sibling / 'component.tsx').read_text() == 'shared uncommitted code'
    assert (root / 'untracked.txt').read_text() == 'local changes'
    if os.environ.get('FAIL_BUILD'):
        sys.exit(42)
    output = root / os.environ.get('FAKE_OUTPUT_DIR', 'dist')
    (output / 'assets').mkdir(parents=True)
    (output / 'assets/app-new.js').write_text('compiled component')
    if os.environ.get('FAKE_NATIVE_PUBLIC'):
        import shutil
        shutil.copytree(root / 'public', output, dirs_exist_ok=True)
    (output / 'index.html').write_text('<script type="module" src="/assets/app-new.js"></script>')
    (output / 'web.config').write_text('config')
    # A second process can erase the LIVE dist: the deploy must not depend on it.
    if os.environ.get('CHANGE_LIVE_DIST'):
        import shutil
        live = pathlib.Path(os.environ['LIVE_ROOT']) / 'dist'
        shutil.rmtree(live)
        live.mkdir()
    if os.environ.get('BREAK_ASSET'):
        (output / 'assets/app-new.js').unlink()
    if os.environ.get('CORRUPT_APK'):
        (root / 'public/apk/app.apk').write_text('bad copy')
'''


class DeployLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='zy-deploy-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'sources/zy_zonayummy'
        self.shared = self.root.parent / 'edalxgoam_components'
        for project in (self.root, self.shared):
            (project / 'node_modules').mkdir(parents=True)
            (project / 'node_modules/live-marker').write_text('do not touch')
            (project / 'package.json').write_text('{}')
            (project / 'package-lock.json').write_text('{}')
        (self.shared / 'src').mkdir()
        (self.shared / 'src/component.tsx').write_text('shared uncommitted code')
        (self.root / 'scripts').mkdir()
        shutil.copyfile(SCRIPT, self.root / 'scripts/deploy.py')
        (self.root / 'deploy.config.json').write_text(json.dumps({
            'localProjects': ['edalxgoam_components'], 'requiredPublic': ['apk/*.apk'], 'keepReleases': 2,
        }))
        (self.root / 'untracked.txt').write_text('local changes')
        (self.root / 'public/apk').mkdir(parents=True)
        (self.root / 'public/apk/app.apk').write_bytes(b'PK\x03\x04new-apk')
        (self.root / 'dist').mkdir()
        (self.root / 'dist/live-build-marker').write_text('live build')
        self.web = self.base / 'published/dist'
        (self.web / 'assets').mkdir(parents=True)
        (self.web / 'index.html').write_text('previous site')
        (self.web / 'assets/old-chunk.js').write_text('previous chunk')
        (self.web / 'apk').mkdir()
        (self.web / 'apk/app.apk').write_text('previous APK')
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        (self.bin / 'npm').write_text(FAKE_NPM)
        (self.bin / 'npm').chmod(0o755)
        self.env = dict(os.environ, PATH=f'{self.bin}:' + os.environ['PATH'],
                        WEB_ROOT=str(self.web), CALL_LOG=str(self.base / 'calls'), LIVE_ROOT=str(self.root))

    def invoke(self, **env):
        return subprocess.run(['python3', str(self.root / 'scripts/deploy.py')],
                              env=dict(self.env, **env), capture_output=True, text=True)

    def assert_live_dependencies_intact(self):
        for project in (self.root, self.shared):
            self.assertEqual((project / 'node_modules/live-marker').read_text(), 'do not touch')
            self.assertFalse((project / 'node_modules/installed-by-test').exists())

    def test_isolation_public_assets_and_atomic_directory_migration(self):
        result = self.invoke(CHANGE_LIVE_DIST='1')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(self.web.is_symlink())
        self.assertEqual((self.web / 'apk/app.apk').read_bytes(), b'PK\x03\x04new-apk')
        self.assertFalse((self.web / 'public').exists())
        self.assertTrue((self.web / 'assets/old-chunk.js').is_file())
        self.assert_live_dependencies_intact()
        calls = [json.loads(line) for line in (self.base / 'calls').read_text().splitlines()]
        self.assertEqual([c['args'][0] for c in calls], ['ci', 'ci', 'run'])
        self.assertTrue(all('/.build-' in c['cwd'] for c in calls))
        self.assertEqual(len(list(self.web.parent.glob('dist-releases/legacy-*'))), 1)
        self.assertFalse(list(self.web.parent.glob('.build-*')))

    def test_install_build_and_validation_failures_preserve_production(self):
        for failure in ('FAIL_INSTALL', 'FAIL_BUILD', 'BREAK_ASSET', 'CORRUPT_APK'):
            with self.subTest(failure=failure):
                result = self.invoke(**{failure: '1'})
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((self.web / 'index.html').read_text(), 'previous site')
                self.assertEqual((self.web / 'apk/app.apk').read_text(), 'previous APK')
                self.assertFalse(self.web.is_symlink())
                self.assert_live_dependencies_intact()
                self.assertFalse(list(self.web.parent.glob('.build-*')))

    def test_lock_rejects_another_deploy_before_copy_or_install(self):
        with (self.web.parent / '.dist.deploy.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = self.invoke()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('already running', result.stderr)
        self.assertFalse((self.base / 'calls').exists())

    def test_repeated_publication_replaces_symlink_and_keeps_previous_release(self):
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stderr)
        previous = self.web.resolve()
        (self.root / 'public/apk/app.apk').write_text('replacement APK')
        second = self.invoke()
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertNotEqual(self.web.resolve(), previous)
        self.assertTrue(previous.is_dir())
        self.assertEqual((previous / 'apk/app.apk').read_bytes(), b'PK\x03\x04new-apk')
        self.assertEqual((self.web / 'apk/app.apk').read_text(), 'replacement APK')
        failed = self.invoke(FAIL_BUILD='1')
        self.assertNotEqual(failed.returncode, 0)
        self.assertEqual((self.web / 'apk/app.apk').read_text(), 'replacement APK')

    def test_missing_manual_apks_blocks_publication(self):
        (self.root / 'public/apk/app.apk').unlink()
        result = self.invoke()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Required local public files missing', result.stderr)
        self.assertFalse((self.base / 'calls').exists())

    def test_native_framework_templates_and_nested_output(self):
        config = json.loads((self.root / 'deploy.config.json').read_text())
        config.update(outputDir='dist/myapp/browser', publicMode='native', publicTemplates=['index.html'])
        (self.root / 'deploy.config.json').write_text(json.dumps(config))
        (self.root / 'public/index.html').write_text('framework template %PUBLIC_URL%')
        result = self.invoke(FAKE_OUTPUT_DIR='dist/myapp/browser', FAKE_NATIVE_PUBLIC='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('app-new.js', (self.web / 'index.html').read_text())
        self.assertEqual((self.web / 'apk/app.apk').read_bytes(), b'PK\x03\x04new-apk')

    def test_clients_without_apks_can_deploy_and_accept_them_later(self):
        config = json.loads((self.root / 'deploy.config.json').read_text())
        config['requiredPublic'] = []
        (self.root / 'deploy.config.json').write_text(json.dumps(config))
        (self.root / 'public/apk/app.apk').unlink()
        first = self.invoke()
        self.assertEqual(first.returncode, 0, first.stderr)
        (self.root / 'public/apk/app.apk').write_bytes(b'new manual APK')
        second = self.invoke()
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual((self.web / 'apk/app.apk').read_bytes(), b'new manual APK')

    def test_excluded_public_exports_are_never_published(self):
        config = json.loads((self.root / 'deploy.config.json').read_text())
        config['excludePublic'] = ['legacy-world']
        (self.root / 'deploy.config.json').write_text(json.dumps(config))
        (self.root / 'public/legacy-world').mkdir()
        (self.root / 'public/legacy-world/index.html').write_text('obsolete export')
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.web / 'legacy-world').exists())
        self.assertTrue((self.root / 'public/legacy-world/index.html').exists())

    def test_external_symlink_cannot_escape_the_snapshot(self):
        (self.root / 'external').symlink_to(self.shared / 'src', target_is_directory=True)
        result = self.invoke()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('symlink', result.stderr)


if __name__ == '__main__':
    unittest.main()
