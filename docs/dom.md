### ROAP DOM

#### Animation Frames

Use `ao_dom_animation()` to create an `ao_fence` generator from successive `requestAnimationFrame` notifications.


#### DOM Listener

Use `ao_dom_listen(pipe = ao_queue())` to connect events to async generator streams.

```
let dom_pipe = ao_dom_listen()

dom_pipe
  .with_dom @
    document.querySelectorAll('input[type=range]')
    elem => ::
      return {key: elem.id, value: elem.valueAsNumber}

  .listen @ 'input', 'change'

  .with_dom @
    document.querySelector('form')

  .listen @ 'submit', (evt, dom) => ::
    evt.preventDefault()
    return @{} form_data: new FormData(elem)

```

##### `with_dom()`

`with_dom(dom, [, fn_dom_value])`

Where `dom` is an iterable or supports the `dom.addEventListener(evt, fn, options)` protocol.
When iterable, calls to `listen()` are broadcast to each member.

Where `fn_dom_value = (dom, evt) => any`, returning a value to send through the asynch pipe.


##### `listen()`

`listen(... event_names, [, options] [, fn_evt_value])`

Where `options` is the third parameter of [addEventListener(evt, fn, options)](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)

Where `fn_evt_value = (evt, dom, fn_dom_value) => any`, returning a value to send through the asynch pipe.

