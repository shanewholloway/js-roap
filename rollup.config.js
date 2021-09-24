import rpi_jsy from 'rollup-plugin-jsy'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import { terser as rpi_terser } from 'rollup-plugin-terser'

const sourcemap = true
const plugins = [ rpi_jsy(), rpi_dgnotify() ]
const plugins_web = [ ... plugins, rpi_terser({}) ]

export default [

  { input: `code/index.jsy`, plugins,
    output: [
      { file: `esm/roap.mjs`, format: 'es', sourcemap },
      { file: `cjs/roap.cjs`, format: 'cjs', sourcemap },
      { file: `umd/roap.js`, name: 'roap', format: 'umd', sourcemap },
    ]},
  
  plugins_web && {
    input: `code/index.jsy`, plugins: plugins_web,
    output: [
      { file: `esm/roap.min.mjs`, format: 'es' },
      { file: `umd/roap.min.js`, name: 'roap', format: 'umd' },
    ]},

].filter(Boolean)


function * add_jsy(src_name, out_name=src_name) {
  yield ({ input: `code/${src_name}.jsy`, plugins,
    output: { file: `esm/${out_name}.mjs`, format: 'es', sourcemap} })

  yield ({ input: `code/${src_name}.jsy`, plugins: plugins_web,
    output: { file: `esm/${out_name}.min.mjs`, format: 'es'} })
}
