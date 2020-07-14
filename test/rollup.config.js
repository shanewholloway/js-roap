import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import rpi_jsy from 'rollup-plugin-jsy'

const sourcemap = 'inline'
const plugins = [ rpi_resolve(), rpi_dgnotify() ]

const plugins_nodejs = [
  rpi_jsy({defines: {PLAT_NODEJS: true}}),
  ... plugins ]
const plugins_web = [
  rpi_jsy({defines: {PLAT_WEB: true}}),
  ... plugins ]


export default [
  { input: `./unittest.jsy`, plugins: plugins_nodejs,
    output: { file: './out/unittest.cjs', format: 'cjs', sourcemap } },

  { input: `./unittest.jsy`, context: 'window', plugins: plugins_web,
    output: { file: './out/unittest.js', format: 'iife', name: `unittest`, sourcemap } },
]
