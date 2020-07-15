### ROAP DOM

### Events

`ao_dom_events(pipe)` returns an event listener api directed at an `ao_pipe()`.
Multiple calls on the same pipe return the DOM events api object through a `WeakRef` cache.


##### `listen(elem, evt, xfn, opt)`

A wrapped form of `elem.addEventListener(evt0, wrapped(xfn), opt)`

```
let some_pipe = ao_pipe()

ao_dom_events(some_pipe)
  .listen(document.querySelector('input'), 'change', evt => evt.value)
```

##### `remove(elem, evt)`

```
ao_dom_events(some_pipe)
  .remove(document.querySelector('input'), 'change')
```

##### `remove(elem)`

```
ao_dom_events(some_pipe)
  .remove(document.querySelector('input'))
```

##### `set_name(elem, name)`

```
ao_dom_events(some_pipe)
  .remove(document.querySelector('input'))
```

##### `with(... ns_args)`

```
ao_dom_events(some_pipe)
  .with(
    { $: document.querySelector('input'),
      change: evt => evt.value
    },

    { $: {
        name_aaa: document.querySelector('#aaa'),
        name_bbb: document.querySelector('#bbb'),
      },
      change: evt => evt.value
    },

    { $: [
        ['name_aaa', document.querySelector('#aaa')],
        ['name_bbb', document.querySelector('#bbb')],
      ],
      change: evt => evt.value
    })

```

#### Animation Frames

Use `async * ao_dom_animation()` to create a `ao_fence` generator from `requestAnimationFrame` notifications.

