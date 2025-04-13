module.exports = {
  apps: [
    {
      name: "workxgoam-firebase", // Nombre personalizado
      script: "npm",
      args: "start",
      cwd: "/root/workxgoam-firebase",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
