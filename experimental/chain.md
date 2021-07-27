### Chaining experimental feature

Chain expressions can be evaluated using `_fn_chain(100).chain(v => v*2).chain(v => v+35).tail === 235`

```javascript
export const _ao_fence_core_api_ = {
  // ...
  chain(fn) { return _fn_chain(this)(fn) },
  // ...
}

export function _fn_chain(tail) {
  chain.tail = tail
  return chain.chain = chain
  function chain(fn) {
    chain.tail = fn(chain.tail)
    return chain
  }
}
```
