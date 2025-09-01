import console from "console";
import esbuild from "esbuild";
import process from "process";

const options = {
  entryPoints: ["src/app.ts"],
  outdir: "dist",
  sourcemap: true,
  bundle: true,
  platform: "node",
  minify: true,
  alias: {
    "@": "src",
  },
};

esbuild.build(options).catch(err => {
  console.error(err);
  process.exit(1);
});
