### ROAP Pipe

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


