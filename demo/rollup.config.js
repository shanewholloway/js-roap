import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import rpi_jsy from 'rollup-plugin-jsy'

const sourcemap = 'inline'
const plugins = [rpi_resolve(), rpi_dgnotify(), rpi_jsy() ]

const configs = []
export default configs


demo_jsy('fence')
demo_jsy('time_interval')
demo_jsy('time_timeout')

demo_jsy('dom_pointer_events')
demo_jsy('dom_input')
demo_jsy('dom_channels')
demo_jsy('dom_storage')


function demo_jsy(src_name='index') {
  configs.push({ plugins,
    input: `${src_name}.jsy`,
    output: { file: `esm/${src_name}.mjs`, format: 'es', sourcemap }})
}

