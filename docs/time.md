### ROAP Time

Use `ao_interval(ms=1000)` to create an `ao_fence` generator from a `setInterval` timer.

Use `ao_timeout(ms=1000)` to create an `ao_fence` generator from successive `setTimeout` timers.

Use `ao_debounce(ms=300, gen_in)` to create an `ao_fence` generator from input `gen_in` debounced with `setTimeout`.

`async * ao_times(gen_in)` asynchronously iterates over `gen_in` and yields time elapsed.

