### ROAP Time

Use `async * ao_interval(opt)` to create a generator from a `setInterval` timer.
(with `opt` as `{ms: milliseconds, trailing: boolean, initial: boolean, xform: () => 1}`)

Use `async * ao_timeout(opt)` to create a generator from successive `setTimeout` timers.
(with `opt` as `{ms: milliseconds, trailing: boolean, xform: () => 1}`)

`async * ao_times(gen_in)` asynchronously iterates over `gen_in` and yields time elapsed.

