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


const _ag_copy = ({g_in}, ag_out) =>(
  undefined === g_in ? ag_out :(
    ag_out.g_in = g_in
  , ag_out) );

function ao_defer_ctx(as_res = (...args) => args) {
  let y,n,_pset = (a,b) => { y=a, n=b; };
  return p =>(
    p = new Promise(_pset)
  , as_res(p, y, n)) }

async function ao_run(gen_in) {
  for await (let v of gen_in) {} }

function ao_fence_v(proto) {
  let reset = ao_defer_ctx(), x=reset(), p=0;

  let fence  = () =>(0 !== p ? p : p=(x=reset())[0]);
  let resume = ans => {p=0; x[1](ans);};
  let abort  = err => {p=0; x[2](err);};

  return proto
    ?{__proto__: proto, fence, resume, abort}
    :[fence, resume, abort] }



const _ao_fence_core_api_ ={
  ao_check_done

, // copyable fence fork api
  [Symbol.asyncIterator]() {
    return this.ao_fork()}

, ao_fork() {
    let ag = this._ao_fork();
    let {xemit} = this;
    return xemit ? xemit(ag) : ag}

, async * _ao_fork() {
    let {fence} = this;
    try {
      while (1) {
        let r = await fence();
        if (undefined !== r) {
          yield r;} } }
    catch (err) {
      ao_check_done(err);} } };


function ao_fence_fn(tgt) {
  let f = ao_fence_v();
  if (undefined === tgt) {tgt = f[0];}
  tgt.fence = Object.assign(tgt, _ao_fence_core_api_);
  return f}


ao_fence_v.bind(null, _ao_fence_core_api_);

const ao_fence_out = ao_fence_v.bind(null,{
  __proto__: _ao_fence_core_api_

, [Symbol.asyncIterator]() {
    return this.ao_bound()}
, ao_bound() {
    throw new Error('ao_fence_out not bound')}
, _ao_many() {
    throw new Error('ao_fence_out consumed; consider .ao_fork() or .allow_many()')}

, allow_many() {
    let {ao_fork, ao_bound, _ao_many} = this;
    if (_ao_many === ao_bound) {
      this.ao_bound = ao_fork;}
    this._ao_many = ao_fork;
    this.allow_many = () => this;
    return this}

, ao_run() {
    let {when_run} = this;
    if (undefined === when_run) {
      this.when_run = when_run =
        ao_run(this.ao_bound()); }
    return when_run}

, bind_gated(f_gate) {
    let ag_out = this._ao_gated(f_gate);
    ag_out.f_out = this;
    ag_out.g_in = this.g_in;
    this.ao_bound = (() => {
      let {xemit, _ao_many} = this;
      this.ao_bound = _ao_many;
      return xemit
        ? _ag_copy(ag_out, xemit(ag_out))
        : ag_out});

    return this}

, async * _ao_gated(f_gate) {
    try {
      this.resume();
      while (1) {
        let v = await f_gate.fence();
        yield v;
        this.resume(v);} }
    catch (err) {
      ao_check_done(err);}
    finally {
      this.abort();
      if (f_gate.abort) {
        f_gate.abort();} } } } );

ao_fence_v.bind(null,{
  __proto__: _ao_fence_core_api_

, ao_fold(ns_gen) {return this.ao_xform({xinit: aog_iter, ... ns_gen})}
, ao_queue(ns_gen) {return this.ao_xform({xinit: aog_sink, ... ns_gen})}

, aog_iter(xf) {return aog_iter(this)}
, aog_sink(f_gate, xf) {return aog_sink(this, f_gate, xf)}

, ao_xform(ns_gen={xinit: aog_sink}) {
    let f_out = ao_fence_out();

    let {xinit, xrecv, xemit} = 
      is_ao_fn(ns_gen)
        ? ns_gen(this, f_out)
        : ns_gen;

    if (undefined !== xemit) {
      f_out.xemit = xemit;}

    if (! xinit) {xinit = aog_sink;}
    let res = xinit(this, f_out, xrecv);

    let ag_out, g_in = res.g_in || res;
    if (res === g_in) {
      // res is an input generator
      g_in.next();
      ag_out = f_out.bind_gated(this);}

    else {
      // res is an output generator
      ag_out = res;}

    ag_out.g_in = f_out.g_in = g_in;
    return ag_out}


, // ES2015 generator api
  next(v) {return {value: this.resume(v), done: true}}
, return() {return {value: this.abort(ao_done), done: true}}
, throw(err) {return {value: this.abort(err), done: true}} } );



function * aog_iter(f_in, f_gate, xf) {
  xf = xf ? _xf_gen.create(xf) : void xf;
  try {
    while (1) {
      let tip = yield;
      if (undefined !== xf) {
        tip = xf.next(tip).value;}
      f_in.resume(tip);} }

  catch (err) {
    ao_check_done(err);}
  finally {
    f_in.abort();
    if (undefined !== xf) {
      xf.return();} } }


async function * aog_sink(f_in, f_gate, xf) {
  xf = xf ? _xf_gen.create(xf) : void xf;
  try {
    while (1) {
       {
        let tip = yield;
        if (undefined !== xf) {
          tip = await xf.next(tip);
          tip = tip.value;}
        f_in.resume(tip);}

      if (undefined !== f_gate) {
        await f_gate.fence();} } }

  catch (err) {
    ao_check_done(err);}
  finally {
    f_in.abort();
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


function ao_timeout(ms=1000) {
  let tid, [_fence, _resume] = ao_fence_fn(timeout);
  return timeout

  function timeout() {
    tid = setTimeout(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    return _fence()} }


async function * ao_times(ao_iterable) {
  let ts0 = Date.now();
  for await (let v of ao_iterable) {
    yield Date.now() - ts0;} }

Promise.resolve({type:'init'});

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

setTimeout(Boolean, 15000);

{(async ()=>{
  let i = 0;
  for await (let v of ao_timeout(1000)) {
    out_log('ao_timeout',{v, i: i++}); } })();}

{(async ()=>{
  let i = 0;
  for await (let ts of ao_times(ao_timeout(1000)) ) {
    out_log('ao_time @ ao_timeout',{ts, i: i++}); } })();}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZV90aW1lb3V0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vX2RlbW9fdXRpbHMuanN5IiwiLi4vdGltZV90aW1lb3V0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUgPSBlcnIgPT4ge1xuICBpZiAoZXJyICE9PSBhb19kb25lICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5jb25zdCBfYWdfY29weSA9ICh7Z19pbn0sIGFnX291dCkgPT4oXG4gIHVuZGVmaW5lZCA9PT0gZ19pbiA/IGFnX291dCA6KFxuICAgIGFnX291dC5nX2luID0gZ19pblxuICAsIGFnX291dCkgKTtcblxuZnVuY3Rpb24gYW9fZGVmZXJfY3R4KGFzX3JlcyA9ICguLi5hcmdzKSA9PiBhcmdzKSB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgYXNfcmVzKHAsIHksIG4pKSB9XG5cbmNvbnN0IGFvX2RlZmVyX3YgPSAvKiAjX19QVVJFX18gKi8gYW9fZGVmZXJfY3R4KCk7XG5cbmNvbnN0IGFvX2RlZmVyID0gLyogI19fUFVSRV9fICovXG4gIGFvX2RlZmVyX2N0eCgocCx5LG4pID0+XG4gICAgKHtwcm9taXNlOiBwLCByZXNvbHZlOiB5LCByZWplY3Q6IG59KSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4pIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIGNsb3NlX3RndCkge1xuICBpZiAoaXNfYW9fZm4oZ2VuX3RndCkpIHtcbiAgICBnZW5fdGd0ID0gZ2VuX3RndCgpO1xuICAgIGdlbl90Z3QubmV4dCgpO31cblxuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgaWYgKGRvbmUpIHticmVha30gfVxuXG4gIGlmIChjbG9zZV90Z3QpIHtcbiAgICBhd2FpdCBnZW5fdGd0LnJldHVybigpO30gfVxuXG5cblxuZnVuY3Rpb24gKiBpdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9faXRlcl9mZW5jZWQoaXRlcmFibGUsIGZfZ2F0ZSwgaW5pdGlhbD1mYWxzZSkge1xuICBsZXQgZiA9IHRydWUgPT09IGluaXRpYWwgPyBmX2dhdGUuZmVuY2UoKSA6IGluaXRpYWw7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICBhd2FpdCBmO1xuICAgIHlpZWxkIHY7XG4gICAgZiA9IGZfZ2F0ZS5mZW5jZSgpO30gfVxuXG5cbmNvbnN0IGFvX2l0ZXJfZmVuY2VkID0gKC4uLmFyZ3MpID0+XG4gIF9hZ19jb3B5KGFyZ3NbMF0sIF9hb19pdGVyX2ZlbmNlZCguLi5hcmdzKSk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3YocHJvdG8pIHtcbiAgbGV0IHJlc2V0ID0gYW9fZGVmZXJfY3R4KCksIHg9cmVzZXQoKSwgcD0wO1xuXG4gIGxldCBmZW5jZSAgPSAoKSA9PigwICE9PSBwID8gcCA6IHA9KHg9cmVzZXQoKSlbMF0pO1xuICBsZXQgcmVzdW1lID0gYW5zID0+IHtwPTA7IHhbMV0oYW5zKTt9O1xuICBsZXQgYWJvcnQgID0gZXJyID0+IHtwPTA7IHhbMl0oZXJyKTt9O1xuXG4gIHJldHVybiBwcm90b1xuICAgID97X19wcm90b19fOiBwcm90bywgZmVuY2UsIHJlc3VtZSwgYWJvcnR9XG4gICAgOltmZW5jZSwgcmVzdW1lLCBhYm9ydF0gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2NvcmVfYXBpXyA9e1xuICBhb19jaGVja19kb25lXG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSB0aGlzLl9hb19mb3JrKCk7XG4gICAgbGV0IHt4ZW1pdH0gPSB0aGlzO1xuICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnKSA6IGFnfVxuXG4sIGFzeW5jICogX2FvX2ZvcmsoKSB7XG4gICAgbGV0IHtmZW5jZX0gPSB0aGlzO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgciA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHIpIHtcbiAgICAgICAgICB5aWVsZCByO30gfSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcbiAgcmV0dXJuIGZ9XG5cblxuY29uc3QgYW9fZmVuY2Vfb2JqID1cbiAgYW9fZmVuY2Vfdi5iaW5kKG51bGwsIF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuXG5mdW5jdGlvbiBhb19zcGxpdChpdGVyYWJsZSkge1xuICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vYmooKTtcbiAgZl9vdXQud2hlbl9ydW4gPSBfYW9fcnVuKGl0ZXJhYmxlLCBmX291dCk7XG4gIGZfb3V0LmdfaW4gPSBpdGVyYWJsZS5nX2luO1xuICByZXR1cm4gZl9vdXR9XG5cbmFzeW5jIGZ1bmN0aW9uIF9hb19ydW4oaXRlcmFibGUsIGZfdGFwKSB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgICAgZl90YXAucmVzdW1lKHYpO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cblxuZnVuY3Rpb24gYW9fdGFwKGl0ZXJhYmxlKSB7XG4gIGxldCBmX3RhcCA9IGFvX2ZlbmNlX29iaigpO1xuICBsZXQgYWdfdGFwID0gX2FvX3RhcChpdGVyYWJsZSwgZl90YXApO1xuICBhZ190YXAuZl90YXAgPSBhZ190YXAuZl9vdXQgPSBmX3RhcDtcbiAgYWdfdGFwLmdfaW4gPSBmX3RhcC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIFtmX3RhcCwgYWdfdGFwXX1cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTtcbiAgICAgIHlpZWxkIHY7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG5cbiAgZmluYWxseSB7XG4gICAgZl90YXAuYWJvcnQoKTt9IH1cblxuY29uc3QgYW9fZmVuY2Vfb3V0ID0gYW9fZmVuY2Vfdi5iaW5kKG51bGwse1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmFvX2JvdW5kKCl9XG4sIGFvX2JvdW5kKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IG5vdCBib3VuZCcpfVxuLCBfYW9fbWFueSgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FvX2ZlbmNlX291dCBjb25zdW1lZDsgY29uc2lkZXIgLmFvX2ZvcmsoKSBvciAuYWxsb3dfbWFueSgpJyl9XG5cbiwgYWxsb3dfbWFueSgpIHtcbiAgICBsZXQge2FvX2ZvcmssIGFvX2JvdW5kLCBfYW9fbWFueX0gPSB0aGlzO1xuICAgIGlmIChfYW9fbWFueSA9PT0gYW9fYm91bmQpIHtcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBhb19mb3JrO31cbiAgICB0aGlzLl9hb19tYW55ID0gYW9fZm9yaztcbiAgICB0aGlzLmFsbG93X21hbnkgPSAoKSA9PiB0aGlzO1xuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX3J1bigpIHtcbiAgICBsZXQge3doZW5fcnVufSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0gd2hlbl9ydW4pIHtcbiAgICAgIHRoaXMud2hlbl9ydW4gPSB3aGVuX3J1biA9XG4gICAgICAgIGFvX3J1bih0aGlzLmFvX2JvdW5kKCkpOyB9XG4gICAgcmV0dXJuIHdoZW5fcnVufVxuXG4sIGJpbmRfZ2F0ZWQoZl9nYXRlKSB7XG4gICAgbGV0IGFnX291dCA9IHRoaXMuX2FvX2dhdGVkKGZfZ2F0ZSk7XG4gICAgYWdfb3V0LmZfb3V0ID0gdGhpcztcbiAgICBhZ19vdXQuZ19pbiA9IHRoaXMuZ19pbjtcbiAgICB0aGlzLmFvX2JvdW5kID0gKCgpID0+IHtcbiAgICAgIGxldCB7eGVtaXQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gX2FvX21hbnk7XG4gICAgICByZXR1cm4geGVtaXRcbiAgICAgICAgPyBfYWdfY29weShhZ19vdXQsIHhlbWl0KGFnX291dCkpXG4gICAgICAgIDogYWdfb3V0fSk7XG5cbiAgICByZXR1cm4gdGhpc31cblxuLCBhc3luYyAqIF9hb19nYXRlZChmX2dhdGUpIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yZXN1bWUoKTtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICAgIHlpZWxkIHY7XG4gICAgICAgIHRoaXMucmVzdW1lKHYpO30gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gICAgZmluYWxseSB7XG4gICAgICB0aGlzLmFib3J0KCk7XG4gICAgICBpZiAoZl9nYXRlLmFib3J0KSB7XG4gICAgICAgIGZfZ2F0ZS5hYm9ydCgpO30gfSB9IH0gKTtcblxuY29uc3QgYW9feGZvcm0gPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb194Zm9ybShuc19nZW4pO1xuY29uc3QgYW9fZm9sZCA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX2ZvbGQobnNfZ2VuKTtcbmNvbnN0IGFvX3F1ZXVlID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUobnNfZ2VuKTtcblxuY29uc3QgYW9fZmVuY2VfaW4gPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIGFvX2ZvbGQobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfaXRlciwgLi4uIG5zX2dlbn0pfVxuLCBhb19xdWV1ZShuc19nZW4pIHtyZXR1cm4gdGhpcy5hb194Zm9ybSh7eGluaXQ6IGFvZ19zaW5rLCAuLi4gbnNfZ2VufSl9XG5cbiwgYW9nX2l0ZXIoeGYpIHtyZXR1cm4gYW9nX2l0ZXIodGhpcyl9XG4sIGFvZ19zaW5rKGZfZ2F0ZSwgeGYpIHtyZXR1cm4gYW9nX3NpbmsodGhpcywgZl9nYXRlLCB4Zil9XG5cbiwgYW9feGZvcm0obnNfZ2VuPXt4aW5pdDogYW9nX3Npbmt9KSB7XG4gICAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb3V0KCk7XG5cbiAgICBsZXQge3hpbml0LCB4cmVjdiwgeGVtaXR9ID0gXG4gICAgICBpc19hb19mbihuc19nZW4pXG4gICAgICAgID8gbnNfZ2VuKHRoaXMsIGZfb3V0KVxuICAgICAgICA6IG5zX2dlbjtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhlbWl0KSB7XG4gICAgICBmX291dC54ZW1pdCA9IHhlbWl0O31cblxuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBsZXQgYWdfb3V0LCBnX2luID0gcmVzLmdfaW4gfHwgcmVzO1xuICAgIGlmIChyZXMgPT09IGdfaW4pIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIGdfaW4ubmV4dCgpO1xuICAgICAgYWdfb3V0ID0gZl9vdXQuYmluZF9nYXRlZCh0aGlzKTt9XG5cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBvdXRwdXQgZ2VuZXJhdG9yXG4gICAgICBhZ19vdXQgPSByZXM7fVxuXG4gICAgYWdfb3V0LmdfaW4gPSBmX291dC5nX2luID0gZ19pbjtcbiAgICByZXR1cm4gYWdfb3V0fVxuXG5cbiwgLy8gRVMyMDE1IGdlbmVyYXRvciBhcGlcbiAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuLCByZXR1cm4oKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChhb19kb25lKSwgZG9uZTogdHJ1ZX19XG4sIHRocm93KGVycikge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoZXJyKSwgZG9uZTogdHJ1ZX19IH0gKTtcblxuXG5cbmZ1bmN0aW9uICogYW9nX2l0ZXIoZl9pbiwgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0geGYubmV4dCh0aXApLnZhbHVlO31cbiAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgICB7XG4gICAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgICB0aXAgPSBhd2FpdCB4Zi5uZXh0KHRpcCk7XG4gICAgICAgICAgdGlwID0gdGlwLnZhbHVlO31cbiAgICAgICAgZl9pbi5yZXN1bWUodGlwKTt9XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGZfZ2F0ZSkge1xuICAgICAgICBhd2FpdCBmX2dhdGUuZmVuY2UoKTt9IH0gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX2luLmFib3J0KCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cblxuY29uc3QgX3hmX2dlbiA9e1xuICBjcmVhdGUoeGYpIHtcbiAgICBsZXQgc2VsZiA9IHtfX3Byb3RvX186IHRoaXN9O1xuICAgIHNlbGYueGcgPSB4ZihzZWxmLnhmX2ludigpKTtcbiAgICByZXR1cm4gc2VsZn1cblxuLCAqeGZfaW52KCkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgdGlwID0gdGhpcy5fdGlwO1xuICAgICAgaWYgKHRoaXMgPT09IHRpcCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZGVyZmxvdycpfVxuICAgICAgZWxzZSB0aGlzLl90aXAgPSB0aGlzO1xuXG4gICAgICB5aWVsZCB0aXA7fSB9XG5cbiwgbmV4dCh2KSB7XG4gICAgdGhpcy5fdGlwID0gdjtcbiAgICByZXR1cm4gdGhpcy54Zy5uZXh0KHYpfVxuXG4sIHJldHVybigpIHt0aGlzLnhnLnJldHVybigpO31cbiwgdGhyb3coKSB7dGhpcy54Zy50aHJvdygpO30gfTtcblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBhb19pdGVyYWJsZSkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLndoZW5fcnVuID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgICAgcCA9IF9mZW5jZSgpO1xuICAgICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCB2KTt9XG5cbiAgICAgIGF3YWl0IHA7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhhb19pdGVyYWJsZSkge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXN1bWUpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBfZXZ0X2luaXQgPSBQcm9taXNlLnJlc29sdmUoe3R5cGU6J2luaXQnfSk7XG5mdW5jdGlvbiBhb19kb21fbGlzdGVuKHNlbGY9YW9fcXVldWUoKSkge1xuICByZXR1cm4gX2JpbmQuc2VsZiA9IHNlbGYgPXtcbiAgICBfX3Byb3RvX186IHNlbGZcbiAgLCB3aXRoX2RvbShkb20sIGZuKSB7XG4gICAgICByZXR1cm4gZG9tLmFkZEV2ZW50TGlzdGVuZXJcbiAgICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSl9IH1cblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgc2VsZi5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYWdfY29weSwgX2FvX2ZlbmNlX2NvcmVfYXBpXywgX2FvX2l0ZXJfZmVuY2VkLCBfYW9fcnVuLCBfYW9fdGFwLCBfeGZfZ2VuLCBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXIsIGFvX2RlZmVyX2N0eCwgYW9fZGVmZXJfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZG9uZSwgYW9fZHJpdmUsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9pbiwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9vdXQsIGFvX2ZlbmNlX3YsIGFvX2ZvbGQsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlZCwgYW9fcXVldWUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9feGZvcm0sIGFvZ19pdGVyLCBhb2dfc2luaywgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJleHBvcnQgZnVuY3Rpb24gYmluZF9vdXRwdXRfbG9nKGVsX291dHB1dD0nb3V0cHV0JykgOjpcbiAgZWxfb3V0cHV0ID0gJ3N0cmluZycgPT09IHR5cGVvZiBlbF9vdXRwdXRcbiAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWxfb3V0cHV0KVxuICAgIDogZWxfb3V0cHV0XG5cbiAgcmV0dXJuIEBcXCAuLi4gYXJncyA6OlxuICAgIGNvbnNvbGUubG9nIEAgLi4uIGFyZ3NcblxuICAgIGxldCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKVxuICAgIGVsLnRleHRDb250ZW50ID0gYXJncy5mbGF0KCkuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyAnKVxuICAgIGVsX291dHB1dC5pbnNlcnRCZWZvcmUoZWwsIGVsX291dHB1dC5maXJzdENoaWxkKVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kX2xvZyhlbF9vdXRwdXQ9J291dHB1dCcpIDo6XG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGRvY3VtZW50XG4gICAgPyBiaW5kX291dHB1dF9sb2coZWxfb3V0cHV0KVxuICAgIDogY29uc29sZS5sb2cuYmluZChjb25zb2xlKVxuIiwiaW1wb3J0IHthb190aW1lb3V0LCBhb190aW1lc30gZnJvbSAncm9hcCdcblxuaW1wb3J0IHtiaW5kX2xvZ30gZnJvbSAnLi9fZGVtb191dGlscy5qc3knXG5sZXQgb3V0X2xvZyA9IGJpbmRfbG9nKCdvdXRwdXQnKVxuXG5sZXQgZGVtb19kdXJhdGlvbiA9IHNldFRpbWVvdXQgQCBCb29sZWFuLCAxNTAwMFxuXG46OiE+XG4gIGxldCBpID0gMFxuICBmb3IgYXdhaXQgbGV0IHYgb2YgYW9fdGltZW91dCgxMDAwKSA6OlxuICAgIG91dF9sb2cgQCAnYW9fdGltZW91dCcsIEB7fSB2LCBpOiBpKytcblxuOjohPlxuICBsZXQgaSA9IDBcbiAgZm9yIGF3YWl0IGxldCB0cyBvZiBhb190aW1lcyBAIGFvX3RpbWVvdXQoMTAwMCkgOjpcbiAgICBvdXRfbG9nIEAgJ2FvX3RpbWUgQCBhb190aW1lb3V0JywgQHt9IHRzLCBpOiBpKytcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sVUFBVSxHQUFHLENBQUM7QUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztBQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7QUFDckIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0FBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUI7QUFDQTtBQUNBLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMvQyxNQUFNLGFBQWEsR0FBRyxHQUFHLElBQUk7QUFDN0IsRUFBRSxJQUFJLEdBQUcsS0FBSyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRTtBQUM5QyxJQUFJLE1B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LElBQUksS0FBSyxHQUFHLFlBQVksRUFBRSxDQUFDO0FBQy9CO0FBQ0EsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUM7QUFDN0IsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDO0FBQ3RCLFVBQVUsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7QUFDN0IsVUFBVSxNQUFNLENBQUM7QUFDakI7QUFDQSxJQUFJLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRTtBQUM3QixNQUFNLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFDM0I7QUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUM7QUFDcEMsSUFBSSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN4QztBQUNBLElBQUksSUFBSSxNQUFNLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ3ZDLElBQUksSUFBSSxHQUFHLEtBQUssSUFBSSxFQUFFO0FBQ3RCO0FBQ0EsTUFBTSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDbEIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDO0FBQ0EsU0FBUztBQUNUO0FBQ0EsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDcEI7QUFDQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEMsSUFBSSxPQUFPLE1BQU0sQ0FBQztBQUNsQjtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3RELEVBQUUsTUFBTSxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM1RCxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsR0FBRztBQUMvRDtBQUNBO0FBQ0E7QUFDQSxXQUFXLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtBQUN0QyxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQztBQUN6QyxFQUFFLElBQUk7QUFDTixJQUFJLE9BQU8sQ0FBQyxFQUFFO0FBQ2QsTUFBTSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDdEIsTUFBTSxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7QUFDNUIsUUFBUSxHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFCO0FBQ0EsRUFBRSxPQUFPLEdBQUcsRUFBRTtBQUNkLElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDeEIsVUFBVTtBQUNWLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ2pCLElBQUksSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFO0FBQzFCLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3ZCO0FBQ0E7QUFDQSxpQkFBaUIsUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0FBQzVDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDO0FBQ3pDLEVBQUUsSUFBSTtBQUNOLElBQUksT0FBTyxDQUFDLEVBQUU7QUFDZCxPQUFPO0FBQ1AsUUFBUSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDeEIsUUFBUSxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7QUFDOUIsVUFBVSxHQUFHLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMzQixRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMxQjtBQUNBLE1BQU0sSUFBSSxTQUFTLEtBQUssTUFBTSxFQUFFO0FBQ2hDLFFBQVEsTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbEM7QUFDQSxFQUFFLE9BQU8sR0FBRyxFQUFFO0FBQ2QsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN4QixVQUFVO0FBQ1YsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDakIsSUFBSSxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7QUFDMUIsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdkI7QUFDQTtBQUNBLE1BQU0sT0FBTyxFQUFFO0FBQ2YsRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFO0FBQ2IsSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNqQyxJQUFJLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBQ2hDLElBQUksT0FBTyxJQUFJLENBQUM7QUFDaEI7QUFDQSxFQUFFLENBQUMsTUFBTSxHQUFHO0FBQ1osSUFBSSxPQUFPLENBQUMsRUFBRTtBQUNkLE1BQU0sSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUMxQixNQUFNLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRTtBQUN4QixRQUFRLE1BQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDckMsV0FBVyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUM1QjtBQUNBLE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ25CO0FBQ0EsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ1YsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNsQixJQUFJLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0I7QUFDQSxFQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztBQUM5QixFQUFFLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFXL0I7QUFDQTtBQUNBLFNBQVMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUU7QUFDN0IsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDcEQsRUFBRSxPQUFPLE9BQU87QUFDaEI7QUFDQSxFQUFFLFNBQVMsT0FBTyxHQUFHO0FBQ3JCLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDakMsSUFBSSxPQUFPLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFtQnRCO0FBQ0E7QUFDQSxpQkFBaUIsUUFBUSxDQUFDLFdBQVcsRUFBRTtBQUN2QyxFQUFFLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUN2QixFQUFFLFdBQVcsSUFBSSxDQUFDLElBQUksV0FBVyxFQUFFO0FBQ25DLElBQUksTUFBTSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRTtBQWE5QjtBQUNrQixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7bUNDdFlMLFFBQVE7RUFDaEQsWUFBWSxRQUFROzs7O0VBSXBCO0lBQ0UsWUFBYTs7SUFFYixnQ0FBZ0MsR0FBRztJQUNuQyxrREFBa0QsR0FBRztJQUNyRDs7OzRCQUcrQixRQUFRO0VBQ3pDLE9BQU8sUUFBUTs7OztBQ1hqQix1QkFBdUIsUUFBUTs7V0FFQzs7O0VBRzlCO2FBQ1M7SUFDUCxRQUFVLFlBQVksRUFBSzs7O0VBRzdCO2FBQ1MsbUJBQXFCO0lBQzVCLFFBQVUsc0JBQXNCLEVBQUsifQ==
