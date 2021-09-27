import rpi_jsy from 'rollup-plugin-jsy'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import { terser as rpi_terser } from 'rollup-plugin-terser'

const plugins = [ rpi_jsy(), rpi_dgnotify() ]
const plugins_web = [ ... plugins, rpi_terser({}) ]

export default [
  ... add_main_jsy('index', 'roap'),

].flat().filter(Boolean)


function * add_main_jsy(src_name, name) {
  yield ({ input: `code/${src_name}.jsy`, plugins,
    output: [
      { file: `esm/${name}.mjs`, format: 'es', sourcemap: true },
      { file: `cjs/${name}.cjs`, format: 'cjs', sourcemap: true },
      { file: `umd/${name}.js`, name, format: 'umd', sourcemap: true },
    ]})
  
  if (plugins_web)
    yield ({
      input: `code/${src_name}.jsy`, plugins: plugins_web,
      output: [
        { file: `esm/${name}.min.mjs`, format: 'es' },
        { file: `umd/${name}.min.js`, name, format: 'umd' },
      ]})
}

function * add_jsy(src_name, out_name=src_name) {
  yield ({ input: `code/${src_name}.jsy`, plugins,
    output: { file: `esm/${out_name}.mjs`, format: 'es', sourcemap: true} })

  yield ({ input: `code/${src_name}.jsy`, plugins: plugins_web,
    output: { file: `esm/${out_name}.min.mjs`, format: 'es'} })
}
