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


function _fn_chain(tail) {
  chain.tail = tail;
  return chain.chain = chain
  function chain(fn) {
    chain.tail = fn(chain.tail);
    return chain} }

const _ag_copy = ({g_in}, ag_out) =>(
  undefined === g_in ? ag_out :(
    ag_out.g_in = g_in
  , ag_out) );

async function ao_run(gen_in) {
  for await (let v of gen_in) {} }

const _noop = ()=>{};
function ao_fence_v(proto) {
  let p=0, _resume = _noop, _abort = _noop;
  let _pset = (y,n) => {_resume=y; _abort=n;};

  let fence = () =>(0 !== p ? p : p=new Promise(_pset));
  let resume = (ans) =>(p=0, _resume(ans));
  let abort = (err=ao_done) =>(p=0, _abort(err));

  return proto
    ?{__proto__: proto, fence, resume, abort}
    :[fence, resume, abort] }



const _ao_fence_core_api_ ={
  ao_check_done
, chain(fn) {return _fn_chain(this)(fn)}

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


const ao_fence_obj =
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

const ao_fence_in = ao_fence_v.bind(null,{
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZV90aW1lb3V0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vX2RlbW9fdXRpbHMuanN5IiwiLi4vdGltZV90aW1lb3V0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUgPSBlcnIgPT4ge1xuICBpZiAoZXJyICE9PSBhb19kb25lICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5mdW5jdGlvbiBfZm5fY2hhaW4odGFpbCkge1xuICBjaGFpbi50YWlsID0gdGFpbDtcbiAgcmV0dXJuIGNoYWluLmNoYWluID0gY2hhaW5cbiAgZnVuY3Rpb24gY2hhaW4oZm4pIHtcbiAgICBjaGFpbi50YWlsID0gZm4oY2hhaW4udGFpbCk7XG4gICAgcmV0dXJuIGNoYWlufSB9XG5cbmNvbnN0IF9hZ19jb3B5ID0gKHtnX2lufSwgYWdfb3V0KSA9PihcbiAgdW5kZWZpbmVkID09PSBnX2luID8gYWdfb3V0IDooXG4gICAgYWdfb3V0LmdfaW4gPSBnX2luXG4gICwgYWdfb3V0KSApO1xuXG5jb25zdCBhb19kZWZlcnJlZF92ID0gKCgoKSA9PiB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgW3AsIHksIG5dKSB9KSgpKTtcblxuY29uc3QgYW9fZGVmZXJyZWQgPSB2ID0+KFxuICB2ID0gYW9fZGVmZXJyZWRfdigpXG4sIHtwcm9taXNlOiB2WzBdLCByZXNvbHZlOiB2WzFdLCByZWplY3Q6IHZbMl19KTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgeWllbGQgKiBpdGVyYWJsZTt9XG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGl0ZXJhYmxlKSB7XG4gIHlpZWxkICogaXRlcmFibGU7fVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX2l0ZXJfZmVuY2VkKGl0ZXJhYmxlLCBmX2dhdGUsIGluaXRpYWw9ZmFsc2UpIHtcbiAgbGV0IGYgPSB0cnVlID09PSBpbml0aWFsID8gZl9nYXRlLmZlbmNlKCkgOiBpbml0aWFsO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgYXdhaXQgZjtcbiAgICB5aWVsZCB2O1xuICAgIGYgPSBmX2dhdGUuZmVuY2UoKTt9IH1cblxuXG5jb25zdCBhb19pdGVyX2ZlbmNlZCA9ICguLi5hcmdzKSA9PlxuICBfYWdfY29weShhcmdzWzBdLCBfYW9faXRlcl9mZW5jZWQoLi4uYXJncykpO1xuXG5jb25zdCBfbm9vcCA9ICgpPT57fTtcbmZ1bmN0aW9uIGFvX2ZlbmNlX3YocHJvdG8pIHtcbiAgbGV0IHA9MCwgX3Jlc3VtZSA9IF9ub29wLCBfYWJvcnQgPSBfbm9vcDtcbiAgbGV0IF9wc2V0ID0gKHksbikgPT4ge19yZXN1bWU9eTsgX2Fib3J0PW47fTtcblxuICBsZXQgZmVuY2UgPSAoKSA9PigwICE9PSBwID8gcCA6IHA9bmV3IFByb21pc2UoX3BzZXQpKTtcbiAgbGV0IHJlc3VtZSA9IChhbnMpID0+KHA9MCwgX3Jlc3VtZShhbnMpKTtcbiAgbGV0IGFib3J0ID0gKGVycj1hb19kb25lKSA9PihwPTAsIF9hYm9ydChlcnIpKTtcblxuICByZXR1cm4gcHJvdG9cbiAgICA/e19fcHJvdG9fXzogcHJvdG8sIGZlbmNlLCByZXN1bWUsIGFib3J0fVxuICAgIDpbZmVuY2UsIHJlc3VtZSwgYWJvcnRdIH1cblxuXG5cbmNvbnN0IF9hb19mZW5jZV9jb3JlX2FwaV8gPXtcbiAgYW9fY2hlY2tfZG9uZVxuLCBjaGFpbihmbikge3JldHVybiBfZm5fY2hhaW4odGhpcykoZm4pfVxuXG4sIC8vIGNvcHlhYmxlIGZlbmNlIGZvcmsgYXBpXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfVxuXG4sIGFvX2ZvcmsoKSB7XG4gICAgbGV0IGFnID0gdGhpcy5fYW9fZm9yaygpO1xuICAgIGxldCB7eGVtaXR9ID0gdGhpcztcbiAgICByZXR1cm4geGVtaXQgPyB4ZW1pdChhZykgOiBhZ31cblxuLCBhc3luYyAqIF9hb19mb3JrKCkge1xuICAgIGxldCB7ZmVuY2V9ID0gdGhpcztcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgbGV0IHIgPSBhd2FpdCBmZW5jZSgpO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSByKSB7XG4gICAgICAgICAgeWllbGQgcjt9IH0gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0gfTtcblxuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9XG4gIGFvX2ZlbmNlX3YuYmluZChudWxsLCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19ib3VuZCgpfVxuLCBhb19ib3VuZCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FvX2ZlbmNlX291dCBub3QgYm91bmQnKX1cbiwgX2FvX21hbnkoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgY29uc3VtZWQ7IGNvbnNpZGVyIC5hb19mb3JrKCkgb3IgLmFsbG93X21hbnkoKScpfVxuXG4sIGFsbG93X21hbnkoKSB7XG4gICAgbGV0IHthb19mb3JrLCBhb19ib3VuZCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICBpZiAoX2FvX21hbnkgPT09IGFvX2JvdW5kKSB7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gYW9fZm9yazt9XG4gICAgdGhpcy5fYW9fbWFueSA9IGFvX2Zvcms7XG4gICAgdGhpcy5hbGxvd19tYW55ID0gKCkgPT4gdGhpcztcbiAgICByZXR1cm4gdGhpc31cblxuLCBhb19ydW4oKSB7XG4gICAgbGV0IHt3aGVuX3J1bn0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHdoZW5fcnVuKSB7XG4gICAgICB0aGlzLndoZW5fcnVuID0gd2hlbl9ydW4gPVxuICAgICAgICBhb19ydW4odGhpcy5hb19ib3VuZCgpKTsgfVxuICAgIHJldHVybiB3aGVuX3J1bn1cblxuLCBiaW5kX2dhdGVkKGZfZ2F0ZSkge1xuICAgIGxldCBhZ19vdXQgPSB0aGlzLl9hb19nYXRlZChmX2dhdGUpO1xuICAgIGFnX291dC5mX291dCA9IHRoaXM7XG4gICAgYWdfb3V0LmdfaW4gPSB0aGlzLmdfaW47XG4gICAgdGhpcy5hb19ib3VuZCA9ICgoKSA9PiB7XG4gICAgICBsZXQge3hlbWl0LCBfYW9fbWFueX0gPSB0aGlzO1xuICAgICAgdGhpcy5hb19ib3VuZCA9IF9hb19tYW55O1xuICAgICAgcmV0dXJuIHhlbWl0XG4gICAgICAgID8gX2FnX2NvcHkoYWdfb3V0LCB4ZW1pdChhZ19vdXQpKVxuICAgICAgICA6IGFnX291dH0pO1xuXG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYXN5bmMgKiBfYW9fZ2F0ZWQoZl9nYXRlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMucmVzdW1lKCk7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgdiA9IGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO1xuICAgICAgICB5aWVsZCB2O1xuICAgICAgICB0aGlzLnJlc3VtZSh2KTt9IH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fVxuICAgIGZpbmFsbHkge1xuICAgICAgdGhpcy5hYm9ydCgpO1xuICAgICAgaWYgKGZfZ2F0ZS5hYm9ydCkge1xuICAgICAgICBmX2dhdGUuYWJvcnQoKTt9IH0gfSB9ICk7XG5cbmNvbnN0IGFvX3hmb3JtID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0obnNfZ2VuKTtcbmNvbnN0IGFvX2ZvbGQgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19mb2xkKG5zX2dlbik7XG5jb25zdCBhb19xdWV1ZSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKG5zX2dlbik7XG5cbmNvbnN0IGFvX2ZlbmNlX2luID0gYW9fZmVuY2Vfdi5iaW5kKG51bGwse1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17eGluaXQ6IGFvZ19zaW5rfSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4aW5pdCwgeHJlY3YsIHhlbWl0fSA9IFxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4ZW1pdCkge1xuICAgICAgZl9vdXQueGVtaXQgPSB4ZW1pdDt9XG5cbiAgICBpZiAoISB4aW5pdCkge3hpbml0ID0gYW9nX3Npbms7fVxuICAgIGxldCByZXMgPSB4aW5pdCh0aGlzLCBmX291dCwgeHJlY3YpO1xuXG4gICAgbGV0IGFnX291dCwgZ19pbiA9IHJlcy5nX2luIHx8IHJlcztcbiAgICBpZiAocmVzID09PSBnX2luKSB7XG4gICAgICAvLyByZXMgaXMgYW4gaW5wdXQgZ2VuZXJhdG9yXG4gICAgICBnX2luLm5leHQoKTtcbiAgICAgIGFnX291dCA9IGZfb3V0LmJpbmRfZ2F0ZWQodGhpcyk7fVxuXG4gICAgZWxzZSB7XG4gICAgICAvLyByZXMgaXMgYW4gb3V0cHV0IGdlbmVyYXRvclxuICAgICAgYWdfb3V0ID0gcmVzO31cblxuICAgIGFnX291dC5nX2luID0gZl9vdXQuZ19pbiA9IGdfaW47XG4gICAgcmV0dXJuIGFnX291dH1cblxuXG4sIC8vIEVTMjAxNSBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9ICk7XG5cblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9IHhmLm5leHQodGlwKS52YWx1ZTt9XG4gICAgICBmX2luLnJlc3VtZSh0aXApO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX2luLmFib3J0KCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb2dfc2luayhmX2luLCBmX2dhdGUsIHhmKSB7XG4gIHhmID0geGYgPyBfeGZfZ2VuLmNyZWF0ZSh4ZikgOiB2b2lkIHhmO1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICAge1xuICAgICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgICAgdGlwID0gYXdhaXQgeGYubmV4dCh0aXApO1xuICAgICAgICAgIHRpcCA9IHRpcC52YWx1ZTt9XG4gICAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fVxuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBmX2dhdGUpIHtcbiAgICAgICAgYXdhaXQgZl9nYXRlLmZlbmNlKCk7fSB9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmNvbnN0IF94Zl9nZW4gPXtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDApIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXN1bWUsIF9hYm9ydF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc3VtZSwgbXMsIDEpO1xuICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICBfZmVuY2Uuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJJbnRlcnZhbCh0aWQpO1xuICAgIF9hYm9ydCgpO30pO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgYW9faXRlcmFibGUpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbigpO1xuXG4gIF9mZW5jZS53aGVuX3J1biA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcDtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgYW9faXRlcmFibGUpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7fVxuXG4gICAgICBhd2FpdCBwO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoYW9faXRlcmFibGUpIHtcbiAgbGV0IHRzMCA9IERhdGUubm93KCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgYW9faXRlcmFibGUpIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcblxuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzdW1lKTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihzZWxmPWFvX3F1ZXVlKCkpIHtcbiAgcmV0dXJuIF9iaW5kLnNlbGYgPSBzZWxmID17XG4gICAgX19wcm90b19fOiBzZWxmXG4gICwgd2l0aF9kb20oZG9tLCBmbikge1xuICAgICAgcmV0dXJuIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICAgID8gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKVxuICAgICAgICA6IF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBkb20pfSB9XG5cbiAgZnVuY3Rpb24gX2JpbmQoZG9tLCBmbl9ldnQsIGZuX2RvbSkge1xuICAgIHJldHVybiBldnQgPT4ge1xuICAgICAgbGV0IHYgPSBmbl9ldnRcbiAgICAgICAgPyBmbl9ldnQoZXZ0LCBkb20sIGZuX2RvbSlcbiAgICAgICAgOiBmbl9kb20oZG9tLCBldnQpO1xuXG4gICAgICBpZiAobnVsbCAhPSB2KSB7XG4gICAgICAgIHNlbGYuZ19pbi5uZXh0KHYpO30gfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pIHtcbiAgbGV0IF9vbl9ldnQ7XG4gIGlmIChpc19hb19mbihmbikpIHtcbiAgICBfZXZ0X2luaXQudGhlbihcbiAgICAgIF9vbl9ldnQgPSBfYmluZChkb20sIHZvaWQgMCwgZm4pKTsgfVxuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGxldCBvcHQsIGV2dF9mbiA9IF9vbl9ldnQ7XG5cbiAgICAgIGxldCBsYXN0ID0gYXJncy5wb3AoKTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBldnRfZm4gPSBfYmluZChkb20sIGxhc3QsIF9vbl9ldnQpO1xuICAgICAgICBsYXN0ID0gYXJncy5wb3AoKTt9XG5cbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgYXJncy5wdXNoKGxhc3QpO31cbiAgICAgIGVsc2Ugb3B0ID0gbGFzdDtcblxuICAgICAgZm9yIChsZXQgZXZ0IG9mIGFyZ3MpIHtcbiAgICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgZXZ0LCBldnRfZm4sIG9wdCk7IH1cblxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBlY3R4X2xpc3QpIHtcbiAgZWN0eF9saXN0ID0gQXJyYXkuZnJvbShlY3R4X2xpc3QsXG4gICAgZG9tID0+IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkpO1xuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGZvciAobGV0IGVjdHggb2YgZWN0eF9saXN0KSB7XG4gICAgICAgIGVjdHgubGlzdGVuKC4uLmFyZ3MpO31cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuZXhwb3J0IHsgX2FnX2NvcHksIF9hb19mZW5jZV9jb3JlX2FwaV8sIF9hb19pdGVyX2ZlbmNlZCwgX2FvX3J1biwgX2FvX3RhcCwgX2ZuX2NoYWluLCBfeGZfZ2VuLCBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3YsIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9saXN0ZW4sIGFvX2RvbmUsIGFvX2RyaXZlLCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfaW4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2Vfb3V0LCBhb19mZW5jZV92LCBhb19mb2xkLCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9faXRlcl9mZW5jZWQsIGFvX3F1ZXVlLCBhb19ydW4sIGFvX3NwbGl0LCBhb19zdGVwX2l0ZXIsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGFvX3hmb3JtLCBhb2dfaXRlciwgYW9nX3NpbmssIGlzX2FvX2ZuLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiZXhwb3J0IGZ1bmN0aW9uIGJpbmRfb3V0cHV0X2xvZyhlbF9vdXRwdXQ9J291dHB1dCcpIDo6XG4gIGVsX291dHB1dCA9ICdzdHJpbmcnID09PSB0eXBlb2YgZWxfb3V0cHV0XG4gICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsX291dHB1dClcbiAgICA6IGVsX291dHB1dFxuXG4gIHJldHVybiBAXFwgLi4uIGFyZ3MgOjpcbiAgICBjb25zb2xlLmxvZyBAIC4uLiBhcmdzXG5cbiAgICBsZXQgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJylcbiAgICBlbC50ZXh0Q29udGVudCA9IGFyZ3MuZmxhdCgpLmZpbHRlcihCb29sZWFuKS5qb2luKCcgJylcbiAgICBlbF9vdXRwdXQuaW5zZXJ0QmVmb3JlKGVsLCBlbF9vdXRwdXQuZmlyc3RDaGlsZClcblxuXG5leHBvcnQgZnVuY3Rpb24gYmluZF9sb2coZWxfb3V0cHV0PSdvdXRwdXQnKSA6OlxuICByZXR1cm4gJ29iamVjdCcgPT09IHR5cGVvZiBkb2N1bWVudFxuICAgID8gYmluZF9vdXRwdXRfbG9nKGVsX291dHB1dClcbiAgICA6IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSlcbiIsImltcG9ydCB7YW9fdGltZW91dCwgYW9fdGltZXN9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCB7YmluZF9sb2d9IGZyb20gJy4vX2RlbW9fdXRpbHMuanN5J1xubGV0IG91dF9sb2cgPSBiaW5kX2xvZygnb3V0cHV0JylcblxubGV0IGRlbW9fZHVyYXRpb24gPSBzZXRUaW1lb3V0IEAgQm9vbGVhbiwgMTUwMDBcblxuOjohPlxuICBsZXQgaSA9IDBcbiAgZm9yIGF3YWl0IGxldCB2IG9mIGFvX3RpbWVvdXQoMTAwMCkgOjpcbiAgICBvdXRfbG9nIEAgJ2FvX3RpbWVvdXQnLCBAe30gdiwgaTogaSsrXG5cbjo6IT5cbiAgbGV0IGkgPSAwXG4gIGZvciBhd2FpdCBsZXQgdHMgb2YgYW9fdGltZXMgQCBhb190aW1lb3V0KDEwMDApIDo6XG4gICAgb3V0X2xvZyBAICdhb190aW1lIEAgYW9fdGltZW91dCcsIEB7fSB0cywgaTogaSsrXG5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLFVBQVUsR0FBRyxDQUFDO0FBQ3BCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbEM7QUFDQSxNQUFNLFFBQVEsR0FBRyxJQUFJO0FBQ3JCLEVBQUUsVUFBVSxLQUFLLE9BQU8sSUFBSTtBQUM1QixPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCO0FB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
