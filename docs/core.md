### ROAP Core

#### Splitting & Tapping

An async generator can be split or tapped to allow forking the stream of values.
These functions asynchronously pull from `gen_in` and use an `ao_fence` to emit "rising edge" values.
The `ao_split(gen_in)` function returns a promise for when `gen_in` is done.
The `ao_tap(gen_in)` function yields the values to create a pass-through generator.

- `ao_split().ao_fork()` and `ao_tap().ao_fork()` returns an async iterator of fenced promises.

Note the fork iterators may drop values compared to the source stream.
Chaining generators ensures all values are iterated.


#### Driving Async Generators

To run an async process, `ao_run(gen_in)` uses an async iterator to pull from `gen_in` and returns a promise for when `gen_in` is done.

To drive an async generator, `ao_drive(gen_in, gen_out, xform)` uses an async iterator to pull from `gen_in` and push values to `gen_out.next`.


#### Deferred Promises

A defer is a `Promise` that exposes the closure `(resolve, reject)` parameters as list elements or object attributes.

- `ao_defer()` returns a deferred object `{promise, resolve(value) : void, reject(error) : void}`
- `ao_defer_v()` returns a deferred list `[promise, resolve(value) : void, reject(error) : void]`

- `ao_when()` and `ao_defer_when()` creates a when-defined map using `ao_defer_v`
- `ao_when_map(ao_fn_v, db=new Map())` creates a map-like object for deferred defintion registries.


#### Tracked Fenced Promises

- `ao_track(proto)` returns a deferred and fenced object `{tip() : promise, resume(ans) : void, abort(error) : void, fence() : promise}`
- `ao_track_v()` returns a mutable track list `[tip promise, resume(ans) : void, abort(error) : void, fence() : promise]`

- `ao_track_when()` creates a when-defined map using `ao_track_v`


#### Misc Utilities

Use `ao_iter(iterable)` to adapt any iterable (array, DOM element, sync iterator) to an async iterator protocol.
Similarly, `iter(iterable)` adapts any non-async iterable (array, DOM element) to a normal iterator protocol.

(See `core/util.jsy` for details.)

