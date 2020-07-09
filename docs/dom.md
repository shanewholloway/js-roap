### ROAP DOM

#### Event Listeners

`ao_dom_events(gen_src)` returns an event listener api directed at an `ao_pipe()`.

- `ag_out.gsrc.events()` return an `ao_dom_events` api for the pipe source.
- `ag_out.gsrc.events(... ns_args)` is an alias for `.events().with(... ns_args)`
- `ag_out.events` is an alias for `ag_out.gsrc.events`

##### Event Listener API

- `name(elem, name)`
- `with(... ns_args)`
- `listen(elem, evt, xfn, opt)`
- `remove(elem, evt)`
- `remove(elem)`

#### Animation Frames

Use `async * ao_dom_animation(opt)` to create a generator from `requestAnimationFrame` notifications.
(with `opt` as `{trailing: boolean, initial: boolean, xform: () => 1}`)

