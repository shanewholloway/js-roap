### ROAP Core

#### Splitting & Tapping

An async generator can be split or tapped to allow forking the stream of values.
These functions function asynchronously pull from `gen_in` and uses an `ao_fence` to emit "rising edge" values.
The `ao_split(gen_in)` function returns a promise for when `gen_in` is done.
The `ao_tap(gen_in)` function yields the values to create a pass-through generator.

- `split().ao_fork()` and `tap().ao_fork()` returns an async iterator of fenced promises.

Note the fork iterators may drop values compared to the source stream.
Chaining generators ensures all values are iterated.


#### Driving Async Generators

To run an async process, `ao_run(gen_in)` uses an async iterator to pull from `gen_in` and returns a promise for when `gen_in` is done.
The `gen_in` parameter is evaluated via `_xinvoke` to accomodate closures.

To drive an async generator, `ao_drive(gen_in, gen_out, xform)` uses an async iterator to pull from `gen_in` and push values to `gen_out.next`.
The `gen_out` or `gen_in` parameters are evaluated via `_xinvoke` to accomodate closures.


#### Deferred Promises

A deferred is a `Promise` that exposes the closure `(resolve, reject)` parameters as list elements or object attributes.

- `ao_deferred()` returns a deferred object `{promise, resolve(value) : void, reject(error) : void}`
- `ao_deferred_v()` returns a deferred list `[promise, resolve(value) : void, reject(error) : void]`


#### Misc Utilities

Use `ao_iter(iterable)` to adapt any iterable (array, DOM element, sync iterator) to an async iterator protocol.
Similarly, `iter(iterable)` adapts any non-async iterable (array, DOM element) to a normal iterator protocol.

Chain expressions can be evaluated using `fn_chain(100).chain(v => v*2).chain(v => v+35).tail === 235`

Functions as value closures are evaluated by `_xinvoke(v_fn)`; if `v_fn` is a function, `v_fn()` is invoked, otherwise `v_fn` is returned as a value.

Pipe generators as closures are evaluated by `_xpipesrc(pipe)`; if `pipe` is a function, `pipe = pipe()` is invoked; `pipe.gsrc || pipe` is returned.

(See `core/util.jsy` for details.)

