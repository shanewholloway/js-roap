### ROAP Core

#### Pipes

A pipe is the core abstraction of ROAP composed of three aspects: input generator, folding compute, and output generator.
The concept is input flows are transformed with a folding compute and emitted from the asynchrnous generator output.
The input rate is decoupled from the async output rate, and the fold compute operation provides the semantics.

The input is a normal (synchronous) generator: `{next(v), return(v), throw(err)}`.
Any code that can invoke `gen.next(value)` can drive the input, supporting zero or more sources, allowing adaptation from event handlers, other generators.

The output is an asynchronous generator: `{async next(v), async return(v), async throw(err)}`.
When iterated, the most recent value (e.g. not `undefined`) from the folding computation is yielded.
If a recent value is not available and can not be pulled, the async generator awaits a promise of a new value.

The compute is folding transformation providing the semantics of the pipe.
Commonly, the fold is a simple identity transformation `v => v`, providing a "most recent value" semantic.
The fold operation may itself be a closure or a generator to accomodate more advanced algorithms.


##### Details of `ao_pipe(... args)`

- `xfold(v)` -- called on push. Commonly just a `v => v` identity transform.
- `xpull()` -- called during async output iteration when no value is ready. Use to pull from memory: queue, sampler, etc.
- `xemit(v)` -- called during async output iteration after a value is emitted. Commonly set to `_xinvoke`.

- `*xgfold()` -- generator or closure defined xfold.
- `*xsrc()` -- feed input from a source generator
- `*xctx(gen_src)` -- on init: bind event sources


##### Details of `ag_out.gsrc`

- `on_fin(gen)`
- `with(xctx)`
- `feed(xsrc, xform)`
- `bind_vec(... keys)`
- `bind_obj(key, ns)`


##### Details of `ag_out`

- `gsrc`
- `stop()`
- `on_fin(gen)`
- `split(xfn)`
- `tap(xfn)`
- `run(xfn)`


#### Splitting & Tapping

An async generator can be split or tapped to allow forking the stream of values.
These functions function asynchronously pull from `gen_in` and uses an `ao_fence` to emit "rising edge" values.
The `ao_split(gen_in)` function returns a promise for when `gen_in` is done.
The `ao_tap(gen_in)` function yields the values to create a pass-through generator.

- `split().fork()` and `tap().fork()` returns an iterator of fenced promises.
- `split().ao_fork()` and `tap().ao_fork()` returns an async iterator of fenced promises.

Note the fork iterators may drop values compared to the source stream.
Chaining generators ensures all values are iterated.


#### Driving Async Generators

To run an async process, `ao_run(gen_in)` uses an async iterator to pull from `gen_in` and returns a promise for when `gen_in` is done.
The `gen_in` parameter is evaluated via `_xinvoke` to accomodate closures.

To drive an async generator, `ao_drive(gen_in, gen_out, xform)` uses an async iterator to pull from `gen_in` and push values to `gen_out.next`.
The `gen_out` or `gen_in` parameters are evaluated via `_xinvoke` to accomodate closures.


#### Fenced Promises

A fence returns one deferred promise. A call to `reset` fulfills the deferred
promise and ratchets to a new promise for fence to return.

- `ao_fence()` returns a fence object `{fence() : promise, reset(value) : void}`. Used for repeated waiters
- `ao_fence_v()` returns a fence list `[fence() : promise, reset(value) : void]`
- `async * ao_fence_marks(fence, trailing, initial, xform)` is a generator gated by promises returned by `fence()`.
    (See `ao_timeout`, `ao_interval`, and `ao_dom_animation`)


#### Deferred Promises

A deferred is a `Promise` that exposes the closure `(resolve, reject)` parameters as list elements or object attributes.

- `ao_deferred()` returns a deferred object `{promise, resolve(value) : void, reject(error) : void}`
- `ao_deferred_v()` returns a deferred list `[promise, resolve(value) : void, reject(error) : void]`


#### Misc Utilities

Functions as value closures are evaluated by `_xinvoke(v_fn)`; if `v_fn` is a function, `v_fn()` is invoked, otherwise `v_fn` is returned as a value.

Pipe generators as closures are evaluated by `_xpipesrc(pipe)`; if `pipe` is a function, `pipe = pipe()` is invoked; `pipe.gsrc || pipe` is returned.

Closures and accessors backed by `WeakMap` are access with `_wm_closure`, `_wm_pipe_closure`, and `_wm_item`. 

(See `core/util.jsy` for details.)

