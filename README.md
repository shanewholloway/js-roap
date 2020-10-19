# ROAP: Reactive Observable Async-iterable Programming

ROAP is reactive programming in a hybrid push/pull model built with JavaScript's async iterator protocol.
By writing async generators, developers directly express intention and can leverage standard debugging tools -- a superior developer experience.

In many Functional Reactive Programming (FRP) systems, new developers confront the cognitive learning curve of the FRP standard library and vocabulary.
FRP systems can be challenging to troubleshoot, as compositions of closures are the primary building block -- providing little surface area for debugging with standard tools.

Direct expression builds upon the existing know-how of many developers and provides surface area for debugging.
Setting aside the purity of FRP, ROAP embraces operating in a world of state -- and therefore side-effects.
State is inherent in async systems: timing, data stores, UIs, and network operations.


##### Inspired By

- Python's async comprehensions.
- JavaScript's async iteration, async generators, and promises.
- ["Elm: Concurrent FRP for Functional GUIs"][elm-paper] by Evan Czaplicki
- [Bacon.js][] and [RxJS][] and [Kefir.js][]
- [D3][] and [Vega][]
- [ObservableHQ][] and spreadsheets 
- Minecraft redstone and Space Chem and Factorio

 [elm-paper]: https://elm-lang.org/assets/papers/concurrent-frp.pdf
 [D3]: https://d3js.org
 [Vega]: https://vega.github.io
 [Bacon.js]: https://baconjs.github.io
 [RxJS]: http://reactivex.io
 [Kefir.js]: http://kefirjs.github.io/kefir/
 [ObservableHQ]: https://observablehq.com


### Docs

- [core](./docs/core.md)
- [fence](./docs/fence.md)
- [time](./docs/time.md)
- [dom](./docs/dom.md)


### Examples

##### Simple

- [`fence`](https://shanewholloway.github.io/js-roap/demo/fence.html)
- [`time_timeout`](https://shanewholloway.github.io/js-roap/demo/time_timeout.html)
- [`time_interval`](https://shanewholloway.github.io/js-roap/demo/time_interval.html)


##### DOM-based

- [`dom_pointer_events`](https://shanewholloway.github.io/js-roap/demo/dom_pointer_events.html)
- [`dom_channels`](https://shanewholloway.github.io/js-roap/demo/dom_channels.html)
- [`dom_input`](https://shanewholloway.github.io/js-roap/demo/dom_input.html)
- [`dom_storage`](https://shanewholloway.github.io/js-roap/demo/dom_storage.html)


### Testing

- [unittests](https://shanewholloway.github.io/js-roap/test/unittest.html)

