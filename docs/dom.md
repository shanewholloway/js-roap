### ROAP DOM

#### Event Listeners

`ao_dom_events(gen_src)` returns an event listener api directed at an `ao_pipe()`.

- `ag_out.gsrc.dom_events`
- `ag_out.gsrc.dom_events(... ns_args)` is an alias for `.dom_events.with(... ns_args)`

##### Event Listener API

- `with(... ns_args)`
- `listen(elem, evt, xfn, opt)`
- `remove(elem, evt)`
- `remove(elem)`
- `set_name(elem, name)`

#### Animation Frames

Use `async * ao_dom_animation(opt)` to create a generator from `requestAnimationFrame` notifications.
(with `opt` as `{trailing: boolean, initial: boolean, signal: true}`)

