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

async function * ao_iter_fenced(iterable, f_gate, initial=false) {
  let f = true === initial ? f_gate.fence() : initial;
  for await (let v of iterable) {
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



const _ao_fence_core_api_ ={
  ao_check_done
, chain(fn) {return fn_chain(this)(fn)}

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


const _ao_fence_gen_api_ ={
  __proto__: _ao_fence_core_api_

, // generator api
  next(v) {return {value: this.resume(v), done: true}}
, return() {return {value: this.abort(ao_done), done: true}}
, throw(err) {return {value: this.abort(err), done: true}} };


const ao_fence_obj =
  ao_fence_v.bind(null, _ao_fence_gen_api_);

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
      this.ao_bound = this._ao_many;
      let {xemit} = this;
      return xemit ? xemit(ag_out) : ag_out});

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
  __proto__: _ao_fence_gen_api_

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

    f_out.xemit = xemit;
    if (! xinit) {xinit = aog_sink;}
    let res = xinit(this, f_out, xrecv);

    let ag_out, g_in = res.g_in || res;
    if (res === g_in) {
      // res is an input generator
      g_in.next();
      ag_out = f_out.bind_gated(this);}

    // else res is an output generator

    ag_out.g_in = f_out.g_in = g_in;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZV90aW1lb3V0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vX2RlbW9fdXRpbHMuanN5IiwiLi4vdGltZV90aW1lb3V0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUgPSBlcnIgPT4ge1xuICBpZiAoZXJyICE9PSBhb19kb25lICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5mdW5jdGlvbiBmbl9jaGFpbih0YWlsKSB7XG4gIGNoYWluLnRhaWwgPSB0YWlsO1xuICByZXR1cm4gY2hhaW4uY2hhaW4gPSBjaGFpblxuICBmdW5jdGlvbiBjaGFpbihmbikge1xuICAgIGNoYWluLnRhaWwgPSBmbihjaGFpbi50YWlsKTtcbiAgICByZXR1cm4gY2hhaW59IH1cblxuY29uc3QgYW9fZGVmZXJyZWRfdiA9ICgoKCkgPT4ge1xuICBsZXQgeSxuLF9wc2V0ID0gKGEsYikgPT4geyB5PWEsIG49YjsgfTtcbiAgcmV0dXJuIHAgPT4oXG4gICAgcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuICAsIFtwLCB5LCBuXSkgfSkoKSk7XG5cbmNvbnN0IGFvX2RlZmVycmVkID0gdiA9PihcbiAgdiA9IGFvX2RlZmVycmVkX3YoKVxuLCB7cHJvbWlzZTogdlswXSwgcmVzb2x2ZTogdlsxXSwgcmVqZWN0OiB2WzJdfSk7XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4pIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIGNsb3NlX3RndCkge1xuICBpZiAoaXNfYW9fZm4oZ2VuX3RndCkpIHtcbiAgICBnZW5fdGd0ID0gZ2VuX3RndCgpO1xuICAgIGdlbl90Z3QubmV4dCgpO31cblxuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgaWYgKGRvbmUpIHticmVha30gfVxuXG4gIGlmIChjbG9zZV90Z3QpIHtcbiAgICBhd2FpdCBnZW5fdGd0LnJldHVybigpO30gfVxuXG5cblxuZnVuY3Rpb24gKiBpdGVyKGl0ZXJhYmxlKSB7XG4gIHlpZWxkICogaXRlcmFibGU7fVxuXG5mdW5jdGlvbiBhb19zdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihpdGVyYWJsZSkge1xuICB5aWVsZCAqIGl0ZXJhYmxlO31cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyX2ZlbmNlZChpdGVyYWJsZSwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgIGF3YWl0IGY7XG4gICAgeWllbGQgdjtcbiAgICBmID0gZl9nYXRlLmZlbmNlKCk7fSB9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3YocHJvdG8pIHtcbiAgbGV0IHA9MCwgX3Jlc3VtZSA9IF89PjAsIF9hYm9ydCA9IF89PjA7XG4gIGxldCBfcHNldCA9ICh5LG4pID0+IHtfcmVzdW1lPXk7IF9hYm9ydD1uO307XG5cbiAgbGV0IGZlbmNlID0gKCkgPT4oMCAhPT0gcCA/IHAgOiBwPW5ldyBQcm9taXNlKF9wc2V0KSk7XG4gIGxldCByZXN1bWUgPSAoYW5zKSA9PihwPTAsIF9yZXN1bWUoYW5zKSk7XG4gIGxldCBhYm9ydCA9IChlcnI9YW9fZG9uZSkgPT4ocD0wLCBfYWJvcnQoZXJyKSk7XG5cbiAgcmV0dXJuIHByb3RvXG4gICAgP3tfX3Byb3RvX186IHByb3RvLCBmZW5jZSwgcmVzdW1lLCBhYm9ydH1cbiAgICA6W2ZlbmNlLCByZXN1bWUsIGFib3J0XSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID17XG4gIGFvX2NoZWNrX2RvbmVcbiwgY2hhaW4oZm4pIHtyZXR1cm4gZm5fY2hhaW4odGhpcykoZm4pfVxuXG4sIC8vIGNvcHlhYmxlIGZlbmNlIGZvcmsgYXBpXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfVxuXG4sIGFvX2ZvcmsoKSB7XG4gICAgbGV0IGFnID0gdGhpcy5fYW9fZm9yaygpO1xuICAgIGxldCB7eGVtaXR9ID0gdGhpcztcbiAgICByZXR1cm4geGVtaXQgPyB4ZW1pdChhZykgOiBhZ31cblxuLCBhc3luYyAqIF9hb19mb3JrKCkge1xuICAgIGxldCB7ZmVuY2V9ID0gdGhpcztcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgbGV0IHIgPSBhd2FpdCBmZW5jZSgpO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSByKSB7XG4gICAgICAgICAgeWllbGQgcjt9IH0gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0gfTtcblxuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IF9hb19mZW5jZV9nZW5fYXBpXyA9e1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCAvLyBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9O1xuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9XG4gIGFvX2ZlbmNlX3YuYmluZChudWxsLCBfYW9fZmVuY2VfZ2VuX2FwaV8pO1xuXG5mdW5jdGlvbiBhb19zcGxpdChpdGVyYWJsZSkge1xuICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vYmooKTtcbiAgZl9vdXQud2hlbl9ydW4gPSBfYW9fcnVuKGl0ZXJhYmxlLCBmX291dCk7XG4gIGZfb3V0LmdfaW4gPSBpdGVyYWJsZS5nX2luO1xuICByZXR1cm4gZl9vdXR9XG5cbmFzeW5jIGZ1bmN0aW9uIF9hb19ydW4oaXRlcmFibGUsIGdfdGFwKSB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgICAgZ190YXAubmV4dCh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBnX3RhcC5yZXR1cm4oKTt9IH1cblxuXG5mdW5jdGlvbiBhb190YXAoaXRlcmFibGUpIHtcbiAgbGV0IGZfdGFwID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBhZ190YXAgPSBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCk7XG4gIGFnX3RhcC5mX3RhcCA9IGFnX3RhcC5mX291dCA9IGZfdGFwO1xuICBhZ190YXAuZ19pbiA9IGZfdGFwLmdfaW4gPSBpdGVyYWJsZS5nX2luO1xuICByZXR1cm4gW2ZfdGFwLCBhZ190YXBdfVxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb190YXAoaXRlcmFibGUsIGdfdGFwKSB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgICAgZ190YXAubmV4dCh2KTtcbiAgICAgIHlpZWxkIHY7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG5cbiAgZmluYWxseSB7XG4gICAgZ190YXAucmV0dXJuKCk7fSB9XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19ib3VuZCgpfVxuLCBhb19ib3VuZCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FvX2ZlbmNlX291dCBub3QgYm91bmQnKX1cbiwgX2FvX21hbnkoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgY29uc3VtZWQ7IGNvbnNpZGVyIC5hb19mb3JrKCkgb3IgLmFsbG93X21hbnkoKScpfVxuXG4sIGFsbG93X21hbnkoKSB7XG4gICAgbGV0IHthb19mb3JrLCBhb19ib3VuZCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICBpZiAoX2FvX21hbnkgPT09IGFvX2JvdW5kKSB7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gYW9fZm9yazt9XG4gICAgdGhpcy5fYW9fbWFueSA9IGFvX2Zvcms7XG4gICAgdGhpcy5hbGxvd19tYW55ID0gKCkgPT4gdGhpcztcbiAgICByZXR1cm4gdGhpc31cblxuLCBhb19ydW4oKSB7XG4gICAgbGV0IHt3aGVuX3J1bn0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHdoZW5fcnVuKSB7XG4gICAgICB0aGlzLndoZW5fcnVuID0gd2hlbl9ydW4gPVxuICAgICAgICBhb19ydW4odGhpcy5hb19ib3VuZCgpKTsgfVxuICAgIHJldHVybiB3aGVuX3J1bn1cblxuLCBiaW5kX2dhdGVkKGZfZ2F0ZSkge1xuICAgIGxldCBhZ19vdXQgPSB0aGlzLl9hb19nYXRlZChmX2dhdGUpO1xuICAgIGFnX291dC5mX291dCA9IHRoaXM7XG4gICAgYWdfb3V0LmdfaW4gPSB0aGlzLmdfaW47XG4gICAgdGhpcy5hb19ib3VuZCA9ICgoKSA9PiB7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gdGhpcy5fYW9fbWFueTtcbiAgICAgIGxldCB7eGVtaXR9ID0gdGhpcztcbiAgICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnX291dCkgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFzeW5jICogX2FvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJlc3VtZSgpO1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgbGV0IHYgPSBhd2FpdCBmX2dhdGUuZmVuY2UoKTtcbiAgICAgICAgeWllbGQgdjtcbiAgICAgICAgdGhpcy5yZXN1bWUodik7fSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgICBmaW5hbGx5IHtcbiAgICAgIHRoaXMuYWJvcnQoKTtcbiAgICAgIGlmIChmX2dhdGUuYWJvcnQpIHtcbiAgICAgICAgZl9nYXRlLmFib3J0KCk7fSB9IH0gfSApO1xuXG5jb25zdCBhb194Zm9ybSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3hmb3JtKG5zX2dlbik7XG5jb25zdCBhb19mb2xkID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fZm9sZChuc19nZW4pO1xuY29uc3QgYW9fcXVldWUgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZShuc19nZW4pO1xuXG5jb25zdCBhb19mZW5jZV9pbiA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfZ2VuX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17eGluaXQ6IGFvZ19zaW5rfSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4aW5pdCwgeHJlY3YsIHhlbWl0fSA9IFxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBmX291dC54ZW1pdCA9IHhlbWl0O1xuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBsZXQgYWdfb3V0LCBnX2luID0gcmVzLmdfaW4gfHwgcmVzO1xuICAgIGlmIChyZXMgPT09IGdfaW4pIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIGdfaW4ubmV4dCgpO1xuICAgICAgYWdfb3V0ID0gZl9vdXQuYmluZF9nYXRlZCh0aGlzKTt9XG5cbiAgICAvLyBlbHNlIHJlcyBpcyBhbiBvdXRwdXQgZ2VuZXJhdG9yXG5cbiAgICBhZ19vdXQuZ19pbiA9IGZfb3V0LmdfaW4gPSBnX2luO1xuICAgIHJldHVybiBhZ19vdXR9IH0gKTtcblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGcsIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9IHhmLm5leHQodGlwKS52YWx1ZTt9XG4gICAgICBnLm5leHQodGlwKTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZy5yZXR1cm4oKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGcsIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgICB7XG4gICAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgICB0aXAgPSBhd2FpdCB4Zi5uZXh0KHRpcCk7XG4gICAgICAgICAgdGlwID0gdGlwLnZhbHVlO31cbiAgICAgICAgYXdhaXQgZy5uZXh0KHRpcCk7fVxuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBmX2dhdGUpIHtcbiAgICAgICAgYXdhaXQgZl9nYXRlLmZlbmNlKCk7fSB9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZy5yZXR1cm4oKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5jb25zdCBfeGZfZ2VuID17XG4gIGNyZWF0ZSh4Zikge1xuICAgIGxldCBzZWxmID0ge19fcHJvdG9fXzogdGhpc307XG4gICAgc2VsZi54ZyA9IHhmKHNlbGYueGZfaW52KCkpO1xuICAgIHJldHVybiBzZWxmfVxuXG4sICp4Zl9pbnYoKSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB0aGlzLl90aXA7XG4gICAgICBpZiAodGhpcyA9PT0gdGlwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5kZXJmbG93Jyl9XG4gICAgICBlbHNlIHRoaXMuX3RpcCA9IHRoaXM7XG5cbiAgICAgIHlpZWxkIHRpcDt9IH1cblxuLCBuZXh0KHYpIHtcbiAgICB0aGlzLl90aXAgPSB2O1xuICAgIHJldHVybiB0aGlzLnhnLm5leHQodil9XG5cbiwgcmV0dXJuKCkge3RoaXMueGcucmV0dXJuKCk7fVxuLCB0aHJvdygpIHt0aGlzLnhnLnRocm93KCk7fSB9O1xuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwLCBnZW5faW4pIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXN1bWUsIF9hYm9ydF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc3VtZSwgbXMsIDEpO1xuICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICBfZmVuY2Uuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJJbnRlcnZhbCh0aWQpO1xuICAgIF9hYm9ydCgpO30pO1xuXG4gIHJldHVybiBudWxsID09IGdlbl9pbiA/IF9mZW5jZVxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCBfZmVuY2UpfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG5cbiAgcmV0dXJuIG51bGwgPT0gZ2VuX2luID8gdGltZW91dFxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCB0aW1lb3V0KVxuXG4gIGZ1bmN0aW9uIHRpbWVvdXQoKSB7XG4gICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLmZpbiA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcDtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgICBwID0gX2ZlbmNlKCk7XG4gICAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIHYpO31cblxuICAgICAgYXdhaXQgcDt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcblxuICByZXR1cm4gbnVsbCA9PSBnZW5faW4gPyByYWZcbiAgICA6IGFvX2l0ZXJfZmVuY2VkKGdlbl9pbiwgcmFmKVxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc3VtZSk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IF9ldnRfaW5pdCA9IFByb21pc2UucmVzb2x2ZSh7dHlwZTonaW5pdCd9KTtcbmZ1bmN0aW9uIGFvX2RvbV9saXN0ZW4oc2VsZj1hb19xdWV1ZSgpKSB7XG4gIHJldHVybiBfYmluZC5zZWxmID0gc2VsZiA9e1xuICAgIF9fcHJvdG9fXzogc2VsZlxuICAsIHdpdGhfZG9tKGRvbSwgZm4pIHtcbiAgICAgIHJldHVybiBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgICAgOiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZG9tKX0gfVxuXG4gIGZ1bmN0aW9uIF9iaW5kKGRvbSwgZm5fZXZ0LCBmbl9kb20pIHtcbiAgICByZXR1cm4gZXZ0ID0+IHtcbiAgICAgIGxldCB2ID0gZm5fZXZ0XG4gICAgICAgID8gZm5fZXZ0KGV2dCwgZG9tLCBmbl9kb20pXG4gICAgICAgIDogZm5fZG9tKGRvbSwgZXZ0KTtcblxuICAgICAgaWYgKG51bGwgIT0gdikge1xuICAgICAgICBzZWxmLmdfaW4ubmV4dCh2KTt9IH0gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSB7XG4gIGxldCBfb25fZXZ0O1xuICBpZiAoaXNfYW9fZm4oZm4pKSB7XG4gICAgX2V2dF9pbml0LnRoZW4oXG4gICAgICBfb25fZXZ0ID0gX2JpbmQoZG9tLCB2b2lkIDAsIGZuKSk7IH1cblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBsZXQgb3B0LCBldnRfZm4gPSBfb25fZXZ0O1xuXG4gICAgICBsZXQgbGFzdCA9IGFyZ3MucG9wKCk7XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgZXZ0X2ZuID0gX2JpbmQoZG9tLCBsYXN0LCBfb25fZXZ0KTtcbiAgICAgICAgbGFzdCA9IGFyZ3MucG9wKCk7fVxuXG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGFyZ3MucHVzaChsYXN0KTt9XG4gICAgICBlbHNlIG9wdCA9IGxhc3Q7XG5cbiAgICAgIGZvciAobGV0IGV2dCBvZiBhcmdzKSB7XG4gICAgICAgIGRvbS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIGV2dCwgZXZ0X2ZuLCBvcHQpOyB9XG5cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZWN0eF9saXN0KSB7XG4gIGVjdHhfbGlzdCA9IEFycmF5LmZyb20oZWN0eF9saXN0LFxuICAgIGRvbSA9PiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pKTtcblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBmb3IgKGxldCBlY3R4IG9mIGVjdHhfbGlzdCkge1xuICAgICAgICBlY3R4Lmxpc3RlbiguLi5hcmdzKTt9XG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cbmV4cG9ydCB7IF9hb19mZW5jZV9jb3JlX2FwaV8sIF9hb19mZW5jZV9nZW5fYXBpXywgX2FvX3J1biwgX2FvX3RhcCwgX3hmX2dlbiwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fbGlzdGVuLCBhb19kb25lLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2luLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX291dCwgYW9fZmVuY2VfdiwgYW9fZm9sZCwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX2l0ZXJfZmVuY2VkLCBhb19xdWV1ZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb194Zm9ybSwgYW9nX2l0ZXIsIGFvZ19zaW5rLCBmbl9jaGFpbiwgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJleHBvcnQgZnVuY3Rpb24gYmluZF9vdXRwdXRfbG9nKGVsX291dHB1dD0nb3V0cHV0JykgOjpcbiAgZWxfb3V0cHV0ID0gJ3N0cmluZycgPT09IHR5cGVvZiBlbF9vdXRwdXRcbiAgICA/IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWxfb3V0cHV0KVxuICAgIDogZWxfb3V0cHV0XG5cbiAgcmV0dXJuIEBcXCAuLi4gYXJncyA6OlxuICAgIGNvbnNvbGUubG9nIEAgLi4uIGFyZ3NcblxuICAgIGxldCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKVxuICAgIGVsLnRleHRDb250ZW50ID0gYXJncy5mbGF0KCkuZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyAnKVxuICAgIGVsX291dHB1dC5pbnNlcnRCZWZvcmUoZWwsIGVsX291dHB1dC5maXJzdENoaWxkKVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBiaW5kX2xvZyhlbF9vdXRwdXQ9J291dHB1dCcpIDo6XG4gIHJldHVybiAnb2JqZWN0JyA9PT0gdHlwZW9mIGRvY3VtZW50XG4gICAgPyBiaW5kX291dHB1dF9sb2coZWxfb3V0cHV0KVxuICAgIDogY29uc29sZS5sb2cuYmluZChjb25zb2xlKVxuIiwiaW1wb3J0IHthb190aW1lb3V0LCBhb190aW1lc30gZnJvbSAncm9hcCdcblxuaW1wb3J0IHtiaW5kX2xvZ30gZnJvbSAnLi9fZGVtb191dGlscy5qc3knXG5sZXQgb3V0X2xvZyA9IGJpbmRfbG9nKCdvdXRwdXQnKVxuXG5sZXQgZGVtb19kdXJhdGlvbiA9IHNldFRpbWVvdXQgQCBCb29sZWFuLCAxNTAwMFxuXG46OiE+XG4gIGxldCBpID0gMFxuICBmb3IgYXdhaXQgbGV0IHYgb2YgYW9fdGltZW91dCgxMDAwKSA6OlxuICAgIG91dF9sb2cgQCAnYW9fdGltZW91dCcsIEB7fSB2LCBpOiBpKytcblxuOjohPlxuICBsZXQgaSA9IDBcbiAgZm9yIGF3YWl0IGxldCB0cyBvZiBhb190aW1lcyBAIGFvX3RpbWVvdXQoMTAwMCkgOjpcbiAgICBvdXRfbG9nIEAgJ2FvX3RpbWUgQCBhb190aW1lb3V0JywgQHt9IHRzLCBpOiBpKytcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sVUFBVSxHQUFHLENBQUM7QUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztBQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7QUFDckIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0FBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUI7QUFDQTtBQUNBLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMvQyxNQUFNLGFBQWEsR0FBRyxHQUFHLElBQUk7QUFDN0IsRUFBRSxJQUFJLEdBQUcsS0FBSyxPQUFPLElBQUksR0FB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
