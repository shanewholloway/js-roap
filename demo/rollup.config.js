import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import rpi_jsy from 'rollup-plugin-jsy'

const sourcemap = 'inline'
const _cfg_ = {plugins: [ rpi_resolve(), rpi_dgnotify(), rpi_jsy() ]}

const configs = []
export default configs


//demo_jsy('.', 'demo')
demo_jsy('.', 'fence')
demo_jsy('time', 'interval')
demo_jsy('time', 'timeout')

demo_jsy('dom')
demo_jsy('dom', 'input')
demo_jsy('dom', 'channels')
demo_jsy('dom', 'storage')


function demo_jsy(folder, src_name='index') {
  configs.push({ ... _cfg_,
    input: `${folder}/${src_name}.jsy`,
    output: { file: `${folder}/esm/${src_name}.mjs`, format: 'es', sourcemap }})
}

