const is_ao_iter = g =>
  null != g[Symbol.asyncIterator];

const is_ao_fn = v_fn =>
  'function' === typeof v_fn
    && ! is_ao_iter(v_fn);


const ao_done = Object.freeze({ao_done: true});
const ao_check_done = err => {
  if (err !== ao_done && err && !err.ao_done) {
    throw err}
  return true};


function fn_chain(tail) {
  chain.tail = tail;
  return chain.chain = chain
  function chain(fn) {
    chain.tail = fn(chain.tail);
    return chain} }

async function ao_run(gen_in) {
  for await (let v of gen_in) {} }


async function * ao_iter_fenced(gen_in, f_gate, initial=false) {
  let f = true === initial ? f_gate.fence() : initial;
  for await (let v of gen_in) {
    await f;
    yield v;
    f = f_gate.fence();} }

function ao_fence_v(proto) {
  let p=0, _resume = _=>0, _abort = _=>0;
  let _pset = (y,n) => {_resume=y; _abort=n;};

  let fence = () =>(0 !== p ? p : p=new Promise(_pset));
  let resume = (ans) =>(p=0, _resume(ans));
  let abort = (err=ao_done) =>(p=0, _abort(err));

  return proto
    ?{__proto__: proto, fence, resume, abort}
    :[fence, resume, abort] }



const _ao_fence_api_ ={
  __proto__:{
    // generator api
    next(v) {return {value: this.resume(v), done: true}}
  , return() {return {value: this.abort(ao_done), done: true}}
  , throw(err) {return {value: this.abort(err), done: true}}

  , ao_check_done
  , chain(fn) {return fn_chain(this)(fn)} }

, // copyable fence api

  [Symbol.asyncIterator]() {
    return this.ao_fork()}

, async * ao_fork() {
    let {fence} = this;
    try {
      while (1) {
        yield await fence();} }
    catch (err) {
      ao_check_done(err);} } };


function ao_fence_fn(tgt) {
  let f = ao_fence_v();
  if (undefined === tgt) {tgt = f[0];}
  tgt.fence = Object.assign(tgt, _ao_fence_api_);
  return f}


const ao_fence_obj = ao_fence_v.bind(null,{
  __proto__: _ao_fence_api_

, async * ao_gated(f_gate) {
    try {
      while (1) {
        let v = await f_gate.fence();
        yield v;
        this.resume(v);} }
    catch (err) {
      ao_check_done(err);}
    finally {
      f_gate.abort();
      this.abort();} } } );

function ao_split(ag_out) {
  let {f_out} = ag_out;
  if (undefined === f_out) {
    [f_out, ag_out] = ao_tap(ag_out);}

  f_out.when_run = ao_run(ag_out);
  return f_out}


function ao_tap(iterable, order=1) {
  let f_tap = ao_fence_obj();
  let ag_tap = _ao_tap(iterable, f_tap, order);
  ag_tap.f_tap = ag_tap.f_out = f_tap;
  ag_tap.g_in = f_tap.g_in = iterable.g_in;
  return [f_tap, ag_tap]}

async function * _ao_tap(iterable, g_tap, order=1) {
  try {
    for await (let v of iterable) {
      if (0 >= order) {await g_tap.next(v);}
      yield v;
      if (0 <= order) {await g_tap.next(v);} } }
  catch (err) {
    ao_check_done(err);}
  finally {
    g_tap.return();} }

const ao_fence_in = ao_fence_v.bind(null,{
  __proto__: _ao_fence_api_

, ao_pipe(ns_gen) {
    return this.ao_xform_run({
      xinit: aog_iter, ... ns_gen}) }
, ao_queue(ns_gen) {
    return this.ao_xform_run({
      xinit: aog_sink, ... ns_gen}) }

, aog_iter(xf) {return aog_iter(this)}
, aog_sink(f_gate, xf) {return aog_sink(this, f_gate, xf)}


, ao_xform_tap(ns_gen) {
    return ao_tap(
      this.ao_xform_raw(ns_gen)) }

, ao_xform_run(ns_gen) {
    return ao_split(
      this.ao_xform_raw(ns_gen)) }

, ao_xform_raw(ns_gen=aog_sink) {
    let {xinit, xrecv, xemit} = ns_gen;
    if (undefined === xinit) {
      xinit = is_ao_fn(ns_gen) ? ns_gen : aog_sink;}


    let ag_out, f_out = ao_fence_obj();
    let res = xinit(this, f_out, xrecv);

    if (undefined !== res.g_in) {
      // res is an output generator
      ag_out = res;
      f_out.g_in = res.g_in;}

    else {
      // res is an input generator
      res.next();

      ag_out = f_out.ao_gated(this);
      ag_out.g_in = f_out.g_in = res;
      ag_out.f_out = f_out;}


    if (xemit) {
      let {g_in} = ag_out;
      ag_out = xemit(ag_out);
      ag_out.g_in = g_in;}

    return ag_out} } );



function * aog_iter(g, f_gate, xf) {
  xf = xf ? _xf_gen.create(xf) : void xf;
  try {
    while (1) {
      let tip = yield;
      if (undefined !== xf) {
        tip = xf.next(tip).value;}
      g.next(tip);} }

  catch (err) {
    ao_check_done(err);}
  finally {
    g.return();
    if (undefined !== xf) {
      xf.return();} } }


async function * aog_sink(g, f_gate, xf) {
  xf = xf ? _xf_gen.create(xf) : void xf;
  try {
    while (1) {
       {
        let tip = yield;
        if (undefined !== xf) {
          tip = await xf.next(tip);
          tip = tip.value;}
        await g.next(tip);}

      if (undefined !== f_gate) {
        await f_gate.fence();} } }

  catch (err) {
    ao_check_done(err);}
  finally {
    g.return();
    if (undefined !== xf) {
      xf.return();} } }


const _xf_gen ={
  create(xf) {
    let self = {__proto__: this};
    self.xg = xf(self.xf_inv());
    return self}

, *xf_inv() {
    while (1) {
      let tip = this._tip;
      if (this === tip) {
        throw new Error('Underflow')}
      else this._tip = this;

      yield tip;} }

, next(v) {
    this._tip = v;
    return this.xg.next(v)}

, return() {this.xg.return();}
, throw() {this.xg.throw();} };


function ao_timeout(ms=1000, gen_in) {
  let tid, [_fence, _resume] = ao_fence_fn(timeout);

  return null == gen_in ? timeout
    : ao_iter_fenced(gen_in, timeout)

  function timeout() {
    tid = setTimeout(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    return _fence()} }


async function * ao_times(gen_in) {
  let ts0 = Date.now();
  for await (let v of gen_in) {
    yield Date.now() - ts0;} }

function bind_output_log(el_output='output') {
  el_output = 'string' === typeof el_output
    ? document.querySelector(el_output)
    : el_output;

  return (( ... args ) => {
    console.log(... args);

    let el = document.createElement('p');
    el.textContent = args.flat().filter(Boolean).join(' ');
    el_output.insertBefore(el, el_output.firstChild);}) }


function bind_log(el_output='output') {
  return 'object' === typeof document
    ? bind_output_log(el_output)
    : console.log.bind(console)}

let out_log = bind_log('output');

let demo_duration = setTimeout(Boolean, 15000);

{(async ()=>{
  let i = 0;
  for await (let v of ao_timeout(1000)) {
    out_log('ao_timeout',{v, i: i++}); } })();}

{(async ()=>{
  let i = 0;
  for await (let ts of ao_times(ao_timeout(1000)) ) {
    out_log('ao_time @ ao_timeout',{ts, i: i++}); } })();}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZV90aW1lb3V0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vX2RlbW9fdXRpbHMuanN5IiwiLi4vdGltZV90aW1lb3V0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUgPSBlcnIgPT4ge1xuICBpZiAoZXJyICE9PSBhb19kb25lICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5mdW5jdGlvbiAqIGl0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogZ2VuX2luO31cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBnZW5faW47fVxuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwpIHtcbiAgY2hhaW4udGFpbCA9IHRhaWw7XG4gIHJldHVybiBjaGFpbi5jaGFpbiA9IGNoYWluXG4gIGZ1bmN0aW9uIGNoYWluKGZuKSB7XG4gICAgY2hhaW4udGFpbCA9IGZuKGNoYWluLnRhaWwpO1xuICAgIHJldHVybiBjaGFpbn0gfVxuXG5jb25zdCBhb19kZWZlcnJlZF92ID0gKCgoKSA9PiB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgW3AsIHksIG5dKSB9KSgpKTtcblxuY29uc3QgYW9fZGVmZXJyZWQgPSB2ID0+KFxuICB2ID0gYW9fZGVmZXJyZWRfdigpXG4sIHtwcm9taXNlOiB2WzBdLCByZXNvbHZlOiB2WzFdLCByZWplY3Q6IHZbMl19KTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXJfZmVuY2VkKGdlbl9pbiwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICBhd2FpdCBmO1xuICAgIHlpZWxkIHY7XG4gICAgZiA9IGZfZ2F0ZS5mZW5jZSgpO30gfVxuXG5mdW5jdGlvbiBhb19mZW5jZV92KHByb3RvKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSBfPT4wLCBfYWJvcnQgPSBfPT4wO1xuICBsZXQgX3BzZXQgPSAoeSxuKSA9PiB7X3Jlc3VtZT15OyBfYWJvcnQ9bjt9O1xuXG4gIGxldCBmZW5jZSA9ICgpID0+KDAgIT09IHAgPyBwIDogcD1uZXcgUHJvbWlzZShfcHNldCkpO1xuICBsZXQgcmVzdW1lID0gKGFucykgPT4ocD0wLCBfcmVzdW1lKGFucykpO1xuICBsZXQgYWJvcnQgPSAoZXJyPWFvX2RvbmUpID0+KHA9MCwgX2Fib3J0KGVycikpO1xuXG4gIHJldHVybiBwcm90b1xuICAgID97X19wcm90b19fOiBwcm90bywgZmVuY2UsIHJlc3VtZSwgYWJvcnR9XG4gICAgOltmZW5jZSwgcmVzdW1lLCBhYm9ydF0gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2FwaV8gPXtcbiAgX19wcm90b19fOntcbiAgICAvLyBnZW5lcmF0b3IgYXBpXG4gICAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuICAsIHJldHVybigpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGFvX2RvbmUpLCBkb25lOiB0cnVlfX1cbiAgLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fVxuXG4gICwgYW9fY2hlY2tfZG9uZVxuICAsIGNoYWluKGZuKSB7cmV0dXJuIGZuX2NoYWluKHRoaXMpKGZuKX0gfVxuXG4sIC8vIGNvcHlhYmxlIGZlbmNlIGFwaVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfVxuXG4sIGFzeW5jICogYW9fZm9yaygpIHtcbiAgICBsZXQge2ZlbmNlfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIHlpZWxkIGF3YWl0IGZlbmNlKCk7fSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfYXBpX1xuXG4sIGFzeW5jICogYW9fZ2F0ZWQoZl9nYXRlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICAgIHlpZWxkIHY7XG4gICAgICAgIHRoaXMucmVzdW1lKHYpO30gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gICAgZmluYWxseSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTtcbiAgICAgIHRoaXMuYWJvcnQoKTt9IH0gfSApO1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IHtmX291dH0gPSBhZ19vdXQ7XG4gIGlmICh1bmRlZmluZWQgPT09IGZfb3V0KSB7XG4gICAgW2Zfb3V0LCBhZ19vdXRdID0gYW9fdGFwKGFnX291dCk7fVxuXG4gIGZfb3V0LndoZW5fcnVuID0gYW9fcnVuKGFnX291dCk7XG4gIHJldHVybiBmX291dH1cblxuXG5mdW5jdGlvbiBhb190YXAoaXRlcmFibGUsIG9yZGVyPTEpIHtcbiAgbGV0IGZfdGFwID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBhZ190YXAgPSBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCwgb3JkZXIpO1xuICBhZ190YXAuZl90YXAgPSBhZ190YXAuZl9vdXQgPSBmX3RhcDtcbiAgYWdfdGFwLmdfaW4gPSBmX3RhcC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIFtmX3RhcCwgYWdfdGFwXX1cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fdGFwKGl0ZXJhYmxlLCBnX3RhcCwgb3JkZXI9MSkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGlmICgwID49IG9yZGVyKSB7YXdhaXQgZ190YXAubmV4dCh2KTt9XG4gICAgICB5aWVsZCB2O1xuICAgICAgaWYgKDAgPD0gb3JkZXIpIHthd2FpdCBnX3RhcC5uZXh0KHYpO30gfSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnX3RhcC5yZXR1cm4oKTt9IH1cblxuY29uc3QgYW9fZmVuY2VfaW4gPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaV9cblxuLCBhb19waXBlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KSB9XG4sIGFvX3F1ZXVlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KSB9XG5cbiwgYW9nX2l0ZXIoeGYpIHtyZXR1cm4gYW9nX2l0ZXIodGhpcyl9XG4sIGFvZ19zaW5rKGZfZ2F0ZSwgeGYpIHtyZXR1cm4gYW9nX3NpbmsodGhpcywgZl9nYXRlLCB4Zil9XG5cblxuLCBhb194Zm9ybV90YXAobnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3RhcChcbiAgICAgIHRoaXMuYW9feGZvcm1fcmF3KG5zX2dlbikpIH1cblxuLCBhb194Zm9ybV9ydW4obnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3NwbGl0KFxuICAgICAgdGhpcy5hb194Zm9ybV9yYXcobnNfZ2VuKSkgfVxuXG4sIGFvX3hmb3JtX3Jhdyhuc19nZW49YW9nX3NpbmspIHtcbiAgICBsZXQge3hpbml0LCB4cmVjdiwgeGVtaXR9ID0gbnNfZ2VuO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHhpbml0KSB7XG4gICAgICB4aW5pdCA9IGlzX2FvX2ZuKG5zX2dlbikgPyBuc19nZW4gOiBhb2dfc2luazt9XG5cblxuICAgIGxldCBhZ19vdXQsIGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSByZXMuZ19pbikge1xuICAgICAgLy8gcmVzIGlzIGFuIG91dHB1dCBnZW5lcmF0b3JcbiAgICAgIGFnX291dCA9IHJlcztcbiAgICAgIGZfb3V0LmdfaW4gPSByZXMuZ19pbjt9XG5cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIHJlcy5uZXh0KCk7XG5cbiAgICAgIGFnX291dCA9IGZfb3V0LmFvX2dhdGVkKHRoaXMpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBmX291dC5nX2luID0gcmVzO1xuICAgICAgYWdfb3V0LmZfb3V0ID0gZl9vdXQ7fVxuXG5cbiAgICBpZiAoeGVtaXQpIHtcbiAgICAgIGxldCB7Z19pbn0gPSBhZ19vdXQ7XG4gICAgICBhZ19vdXQgPSB4ZW1pdChhZ19vdXQpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBnX2luO31cblxuICAgIHJldHVybiBhZ19vdXR9IH0gKTtcblxuXG5cbmZ1bmN0aW9uICogYW9nX2l0ZXIoZywgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0geGYubmV4dCh0aXApLnZhbHVlO31cbiAgICAgIGcubmV4dCh0aXApO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnLnJldHVybigpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX3NpbmsoZywgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgIHtcbiAgICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgICAgIHRpcCA9IGF3YWl0IHhmLm5leHQodGlwKTtcbiAgICAgICAgICB0aXAgPSB0aXAudmFsdWU7fVxuICAgICAgICBhd2FpdCBnLm5leHQodGlwKTt9XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGZfZ2F0ZSkge1xuICAgICAgICBhd2FpdCBmX2dhdGUuZmVuY2UoKTt9IH0gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnLnJldHVybigpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmNvbnN0IF94Zl9nZW4gPXtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDAsIGdlbl9pbikge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIG51bGwgPT0gZ2VuX2luID8gX2ZlbmNlXG4gICAgOiBhb19pdGVyX2ZlbmNlZChnZW5faW4sIF9mZW5jZSl9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwLCBnZW5faW4pIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcblxuICByZXR1cm4gbnVsbCA9PSBnZW5faW4gPyB0aW1lb3V0XG4gICAgOiBhb19pdGVyX2ZlbmNlZChnZW5faW4sIHRpbWVvdXQpXG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7fVxuXG4gICAgICBhd2FpdCBwO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoZ2VuX2luKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiBudWxsID09IGdlbl9pbiA/IHJhZlxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCByYWYpXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzdW1lKTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihwaXBlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpKSB7XG4gIGxldCB3aXRoX2RvbSA9IChkb20sIGZuKSA9PlxuICAgIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSk7XG5cbiAgX2JpbmQuc2VsZiA9IHtwaXBlLCB3aXRoX2RvbX07XG4gIHBpcGUud2l0aF9kb20gPSB3aXRoX2RvbTtcbiAgcmV0dXJuIHBpcGVcblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgcGlwZS5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYW9fZmVuY2VfYXBpXywgX2FvX3RhcCwgX3hmX2dlbiwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fbGlzdGVuLCBhb19kb25lLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2luLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX3YsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlZCwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb2dfaXRlciwgYW9nX3NpbmssIGZuX2NoYWluLCBpc19hb19mbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImV4cG9ydCBmdW5jdGlvbiBiaW5kX291dHB1dF9sb2coZWxfb3V0cHV0PSdvdXRwdXQnKSA6OlxuICBlbF9vdXRwdXQgPSAnc3RyaW5nJyA9PT0gdHlwZW9mIGVsX291dHB1dFxuICAgID8gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihlbF9vdXRwdXQpXG4gICAgOiBlbF9vdXRwdXRcblxuICByZXR1cm4gQFxcIC4uLiBhcmdzIDo6XG4gICAgY29uc29sZS5sb2cgQCAuLi4gYXJnc1xuXG4gICAgbGV0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpXG4gICAgZWwudGV4dENvbnRlbnQgPSBhcmdzLmZsYXQoKS5maWx0ZXIoQm9vbGVhbikuam9pbignICcpXG4gICAgZWxfb3V0cHV0Lmluc2VydEJlZm9yZShlbCwgZWxfb3V0cHV0LmZpcnN0Q2hpbGQpXG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJpbmRfbG9nKGVsX291dHB1dD0nb3V0cHV0JykgOjpcbiAgcmV0dXJuICdvYmplY3QnID09PSB0eXBlb2YgZG9jdW1lbnRcbiAgICA/IGJpbmRfb3V0cHV0X2xvZyhlbF9vdXRwdXQpXG4gICAgOiBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpXG4iLCJpbXBvcnQge2FvX3RpbWVvdXQsIGFvX3RpbWVzfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQge2JpbmRfbG9nfSBmcm9tICcuL19kZW1vX3V0aWxzLmpzeSdcbmxldCBvdXRfbG9nID0gYmluZF9sb2coJ291dHB1dCcpXG5cbmxldCBkZW1vX2R1cmF0aW9uID0gc2V0VGltZW91dCBAIEJvb2xlYW4sIDE1MDAwXG5cbjo6IT5cbiAgbGV0IGkgPSAwXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBhb190aW1lb3V0KDEwMDApIDo6XG4gICAgb3V0X2xvZyBAICdhb190aW1lb3V0JywgQHt9IHYsIGk6IGkrK1xuXG46OiE+XG4gIGxldCBpID0gMFxuICBmb3IgYXdhaXQgbGV0IHRzIG9mIGFvX3RpbWVzIEAgYW9fdGltZW91dCgxMDAwKSA6OlxuICAgIG91dF9sb2cgQCAnYW9fdGltZSBAIGFvX3RpbWVvdXQnLCBAe30gdHMsIGk6IGkrK1xuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxVQUFVLEdBQUcsQ0FBQztBQUNwQixFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2xDO0FBQ0EsTUFBTSxRQUFRLEdBQUcsSUFBSTtBQUNyQixFQUFFLFVBQVUsS0FBSyxPQUFPLElBQUk7QUFDNUIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQjtBQUNBO0FBQ0EsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQy9DLE1BQU0sYUFBYSxHQUFHLEdBQUcsSUFBSTtBQUM3QixFQUFFLElBQUksR0FBRyxLQUFLLE9BQU8sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFO0FBQzlDLElBQUksTUFBTSxHQUFHLENBQUM7QUFDZCxFQUFFLE9BQU8sSUFBSSxDQUFDLENBQUM7QUFPZjtBQUNBO0FBQ0EsU0FBUyxRQUFRLENBQUMsSUFBSSxFQUFFO0FBQ3hCLEVBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsRUFBRSxPQUFPLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSztBQUM1QixFQUFFLFNBQVMsS0FBSyxDQUFDLEVBQUUsRUFBRTtBQUNyQixJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxJQUFJLE9BQU8sS0FBSyxDQUFD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
