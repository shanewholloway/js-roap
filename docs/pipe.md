### ROAP Queue

Use `ao_queue(xform)` to create a 1:1 input:output async generator stream.
In contrast to `ao_pipe()`, a queue emits every input and does not "fold" the inputs.
However, this may require memory when the queue input exceeds the queue output.
Queue memory comes from the async generator behavior of the JavaScript VM.


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

- `kind` -- default: 'split'; one of `['raw', 'split', 'tap']`
- `xfold(v)` -- called on push. Commonly just a `v => v` identity transform.
- `xpull()` -- called during async output iteration when no value is ready. Use to pull from memory: queue, sampler, etc.
- `xemit(v)` -- called during async output iteration after a value is emitted. Commonly set to `_xinvoke`.

- `*xgfold()` -- generator or closure defined xfold.
- `*xctx(gen_src)` -- on init: bind event sources
- `*xsrc()` -- feed input from a source generator and end the pipe output stream.


##### Details of `ag_out`

- `g_in` -- input generator for feeding values
- `stop()` -- stop all associated generators
- `on_fin(gen)` -- associate a generator lifetime

