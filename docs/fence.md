### ROAP Fences

A fence is a resetable deferred promise mechanism.
Calling `fence() : promise` returns a deferred promise.
Calling `resume(value)` fulfills the existing deferred promise and ratchets `fence` to return a new deferred promise.
Calling `abort(err)` rejects the existing deferred promise and ratchets `fence` to return a new deferred promise.

- `ao_fence_v()` is the minimal version, return a list of: `[fence(), reset(value), abort(err)]`.
- `ao_fence_v(proto)` is the minimal object version, returning `{__proto__: proto, fence, reset, abort}`.
- `ao_fence_obj()` is the default object version of `{fence, reset, abort}` supporting the Fence API.

- `ao_fence_fn(tgt)` returns a list of `[fence, reset, abort]` where `tgt` supports the Fence API.
  When `tgt` is absent, `tgt = fence` is used.

- `ao_fence_out()` returns an object of `{fence, reset, abort}` supporting the Fence Output API.
- `ao_fence_in()` returns an object of `{fence, reset, abort}` supporting the Fence Input API.


#### Fence Core API


- `ao_fork()` -- an async iterable that emits successive `fence()` responses.
- `[Symbol.asyncIterator]()` -- alias for `this.ao_fork()`
- `ao_check_done(v)` -- returns true when v is a valid `ao_done` signal, otherwise `throw v`


(see _ao_fence_core_api_ from `core/fence.jsy`)


#### Fence Output API

TODO: Expound why `core/fence_out.jsy` is useful outside of `core/fence_in.jsy`.
Then add useful documentation.


- `[Symbol.asyncIterator]()` -- alias for `this.ao_bound()`
- `async * ao_bound()` is dynamically bound async generator. See `bind_gated(f_gate)`
- `allow_many()` -- allows implicit multiple `ao_fork` subscribed async iterators.
- `ao_run()` -- on first call, invokes `ao_run(this.ao_bound())` to run async process and assigns `when_run`; returns `when_run` promise.
- `async * ao_gated(f_gate)` -- provides fence pulses that drive `ao_fork()`
- `async * _ao_gated(f_gate)` -- implementation of fence pulses that drive `ao_fork()`
- `bind_gated(f_gate) : this` -- binds `ao_bound` to `_ao_gated(f_gate)`


#### Fence Input API

- `ao_fold(ns_gen)` -- alias for `this.ao_xform_run({xinit: aog_iter, ...ns_gen})`
- `ao_queue(ns_gen)` -- alias for `this.ao_xform_run({xinit: aog_sink, ...ns_gen})`
- `ao_xform(ns_gen)` -- sophisticated async generator composer.
  - `{xinit}` -- used to drive `fence_in.xform()`
  - `{xemit}` -- used to wrap output generator
  - `{xrecv}` -- used in `xinit` to transform before `xemit`; see `aog_iter`, and `aog_sink` for examples.

- `aog_iter(xf)` -- initializer for blocking generator
- `aog_sink(f_gate, xf)` -- initializer for async generator gated by `f_gate`

- [generator protocol api](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) ::
  - `next(v) => {value, done}`
  - `return(v) => {value, done}`
  - `throw(err) => {value, done}`

