### ROAP Fences

A fence is a resetable deferred promise mechanism.
Calling `fence() : promise` returns a deferred promise.
Calling `resume(value)` fulfills the existing deferred promise and ratchets `fence` to return a new deferred promise.
Calling `abort(err)` rejects the existing deferred promise and ratchets `fence` to return a new deferred promise.

- `ao_fence_v()` is the minimal version, return a list of: `[fence(), reset(value), abort(err)]`.
- `ao_fence_fn(tgt)` returns a list of `[fence, reset, abort]` where `fence` supports the Fence API.
- `ao_fence_obj()` returns an object of `{fence, reset, abort}` supporting the Fence Output API.
- `ao_fence_in()` returns an object of `{fence, reset, abort}` supporting the Fence Input API.

#### Fence Core API

- fence delegate api:
  - `ao_fork()` -- an async iterable that emits successive `fence()` responses.
  - `[Symbol.asyncIterator]()` -- alias for `this.ao_fork()`

- generator protocol api ::
  - `next(v) => {value, done}`
  - `return(v) => {value, done}`
  - `throw(err) => {value, done}`

- `ao_check_done(v)` -- returns true when v is a valid `ao_done` signal, otherwise `throw v`
- `chain(fn) => {tail, chain(fn)}` -- chaining function invocations


##### Fence Delegate API

- `ao_fork()`
- `[Symbol.asyncIterator]()`


#### Fence Output API

- `async * ao_gated(f_gate)` -- provides fence pulses that drive `ao_fork()`

#### Fence Input API

- `ao_pipe(ns_gen)` -- alias for `this.ao_xform_run({xinit: aog_iter, ...ns_gen})`
- `ao_queue(ns_gen)` -- alias for `this.ao_xform_run({xinit: aog_sink, ...ns_gen})`

- `ao_xform_tap(ns_gen)` -- alias for `ao_tap(this.ao_xform_run(ns_gen))`
- `ao_xform_run(ns_gen)` -- alias for `ao_split(this.ao_xform_run(ns_gen))`

- `ao_xform_raw(ns_gen)` -- sophisticated async generator composer.

- `aog_iter(xf)` -- normal block generator initializer
- `aog_sink(f_gate, xf)` -- async generator gated by `f_gate` initializer

