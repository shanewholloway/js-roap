const {
  assign: _obj_assign,
  defineProperties: _obj_props,
} = Object;

const is_ao_iter = g =>
  null != g[Symbol.asyncIterator];

const _is_fn = v_fn =>
  'function' === typeof v_fn
    && ! is_ao_iter(v_fn);
const _ret_ident = v => v;

const _xinvoke = v_fn =>
  _is_fn(v_fn)
    ? v_fn()
    : v_fn;

function _xpipe_tgt(pipe) {
  if (_is_fn(pipe)) {
    pipe = pipe();
    pipe.next();
    return pipe}

  return pipe.g_in || pipe}


function fn_chain(tail, ctx) {
  return _obj_assign(chain, {chain, tail})
  function chain(fn) {
    chain.tail = fn(chain.tail, ctx);
    return chain} }

const ao_sym_done = Symbol('ao_done');

function ao_fence_v() {
  let p=0, _resume = ()=>{};
  let _pset = a => _resume = a;

  return [
    () => 0 !== p ? p
      : p = new Promise(_pset)

  , v => {p = 0; _resume(v);} ] }



const _ao_fence_api ={
  stop() {this.fence.done = true;}

, ao_fork() {
    return ao_fence_fork(this.fence)}

, [Symbol.asyncIterator]() {
    return this.ao_fork()} };

function ao_fence_fn(tgt) {
  let f = ao_fence_v();
  if (undefined === tgt) {tgt = f[0];}
  tgt.fence = _obj_assign(tgt, _ao_fence_api);
  return f}


async function * ao_fence_fork(fence) {
  while (! fence.done) {
    let v = await fence();
    if (fence.done || v === ao_sym_done) {
      return v}
    yield v;} }


async function * _ao_fence_loop(fence, reset, xform) {
  try {
    let v;
    while (! fence.done) {
      v = await fence();
      if (v === ao_sym_done) {
        return}

      v = yield v;
      if (undefined !== xform) {
        v = await xform(v);}
      reset(v); } }
  finally {
    reset(ao_sym_done);} }

async function ao_run(gen_in, notify=_ret_ident) {
  for await (let v of _xinvoke(gen_in)) {
    notify(v);} }


async function ao_drive(gen_in, gen_tgt, xform=_ret_ident) {
  gen_tgt = _xpipe_tgt(gen_tgt);
  for await (let v of _xinvoke(gen_in)) {
    if (undefined !== gen_tgt) {
      v = xform(v);
      let {done} = await gen_tgt.next(v);
      if (done) {break} } } }

function ao_fork() {
  return ao_fence_fork(this.fence)}

const _ao_tap_props ={
  ao_fork:{value: ao_fork}
, chain:{get() {
    return fn_chain(this, this)} } };

function ao_tap(ag_out) {
  return _obj_props(_ao_tap(ag_out), _ao_tap_props) }

function _ao_tap(ag_out) {
  let [fence, reset] = ao_fence_v();
  let gen = ((async function * () {
    fence.done = false;
    try {
      for await (let v of _xinvoke(ag_out)) {
        reset(v);
        yield v;} }
    finally {
      fence.done = true;
      reset();} }).call(this));

  gen.fence = fence;
  return gen}



const _ao_split_api ={
  get chain() {
    return fn_chain(this, this)}
, [Symbol.asyncIterator]: ao_fork
, ao_fork};

function ao_split(ag_out) {
  let gen = _ao_tap(ag_out);
  return {
    __proto__: _ao_split_api
  , fin: ao_run(gen)
  , fence: gen.fence} }

function ao_queue(xform) {
  let [fence, out_reset] = ao_fence_fn();
  let [in_fence, in_reset] = ao_fence_v();

  let ag_out = _ao_fence_loop(fence, in_reset);
  let g_in = _ao_fence_loop(in_fence, out_reset, xform);

  // allow g_in to initialize
  g_in.next() ; in_reset();
  return _obj_assign(ag_out, {fence, g_in}) }

const _as_pipe_end = (g,ns) => _obj_assign(g, ns);

//~~~
// Pipe base as generator in composed object-functional implementation

const _ao_pipe_base ={
  xfold: v => v // on push: identity transform
, xpull() {} // memory: none
, xemit: _xinvoke // identity transform or invoke if function
, xinit(g_in, ag_out) {} // on init: default behavior

, get create() {
    // as getter to bind class as `this` at access time
    const create = (... args) =>
      _obj_assign({__proto__: this},
        ... args.map(_xinvoke))
      ._ao_pipe();

    return create.create = create}

, _ao_pipe() {
    let fin_lst = [];

    let on_fin = this.on_fin =
      g =>(fin_lst.push(g), g);

    let stop = this.stop = (() => {
      this.done = true;
      _fin_pipe(fin_lst);
      this._resume();});


    let g_in = on_fin(
      this._ao_pipe_in());

    let ag_out = on_fin(
      this._ao_pipe_out());

    // adapt ag_out by api and kind
    let self = {stop, on_fin, g_in};
    ag_out = this._as_pipe_out(
      ag_out, self, this.kind);

    ag_out = this.xinit(g_in, ag_out) || ag_out;

    // allow g_in to initialize
    g_in.next();
    return ag_out}

, _as_pipe_out: _as_pipe_end

, //~~~
  // Upstream input generator
  //   designed for multiple feeders

  *_ao_pipe_in() {
    try {
      let v;
      while (! this.done) {
        v = this.xfold(yield v);
        this.value = v;
        if (0 !== this._waiting && undefined !== v) {
          this._resume();} } }

    finally {
      this.stop();} }


, //~~~
  // Downstream async output generator
  //   designed for single consumer.

  async *_ao_pipe_out() {
    try {
      let r;
      while (! this.done) {
        if (0 !== (r = this._waiting)) {
          // p0: existing waiters
          r = await r;
          if (this.done) {break} }
        else if (undefined !== (r = this.value)) {
          // p1: available value
          this.value = undefined;}
        else if (undefined !== (r = this.xpull())) {
          }// p2: xpull value (e.g. queue memory) 
        else {
          // p3: add new waiter
          r = await this._bind_waiting();
          if (this.done) {break} }

        yield this.xemit(r);} }

    finally {
      this.stop();} }


, //~~~
  // generator-like value/done states

  value: undefined
, done: false

, //~~~
  // promise-based fence tailored for ao_pipe usecase

  _waiting: 0
, _fulfill() {}
, async _resume() {
    if (! this.done) {await this;}

    let {value, _fulfill} = this;
    if (undefined != value || this.done) {
      this.value = undefined;
      this._waiting = 0;
      _fulfill(value);} }

, _bind_waiting() {
    let _reset = y => this._fulfill = y;
    this._bind_waiting = () => this._waiting ||(
      this._waiting = new Promise(_reset));
    return this._bind_waiting()} };


function _fin_pipe(fin_lst) {
  while (0 !== fin_lst.length) {
    let g = fin_lst.pop();
    try {
      if (_is_fn(g)) {g();}
      else g.return();}
    catch (err) {
      if (err instanceof TypeError) {
        if ('Generator is already running' === err.message) {
          continue} }
      console.error(err);} } }

const _ao_pipe_out_kinds ={
  ao_raw: g => g
, ao_split: ao_split
, ao_tap: ao_tap};

function _ao_pipe_out(ag_out, self, kind) {
  kind = /^ao_/.test(kind) ? kind : 'ao_'+kind;
  let ao_wrap = _ao_pipe_out_kinds[kind];
  if (undefined === ao_wrap) {
    throw new Error(`Unknonwn ao_pipe_out kind "${kind}"`)}

  return _obj_assign(ao_wrap(ag_out), self) }

const _ao_pipe ={
  __proto__: _ao_pipe_base

, // xfold: v => v -- on push: identity transform
  // xpull() {} -- memory: none
  // xemit: _xinvoke -- identity transform or invoke if function

  // *xgfold() -- on push: generator-based fold impl
  // *xsrc() -- feed with source generator
  // *xctx(gen_src) -- on init: bind event sources

  kind: 'split'
, //_as_pipe_in: _ao_pipe_in
  _as_pipe_out: _ao_pipe_out

, xinit(g_in, ag_out) {
    let xgfold = this.xgfold;
    if (undefined !== xgfold) {
      this._init_xgfold(g_in, xgfold);}

    this._init_chain(g_in);}


, _init_xgfold(g_in, xgfold) {
    if (undefined === xgfold) {
      return}

    if (_is_fn(xgfold)) {
      xgfold = xgfold.call(this, this);

      if (_is_fn(xgfold)) {
        this.xfold = xgfold;
        return true}

      xgfold.next();}

    this.xgfold = xgfold;
    this.xfold = this._fold_gen;
    this.on_fin(xgfold);
    return true}

, _fold_gen(v) {
    let {done, value} = this.xgfold.next(v);
    if (done) {this.done = true;}
    return value}


, _init_chain(g_in) {
    let {xsrc, xctx} = this;
    if (undefined !== xsrc) {
      ao_drive(xsrc, g_in)
        .then (() =>g_in.return()); }

    if (undefined !== xctx) {
      this._with_ctx(g_in, xctx);} }

, _with_ctx(g_in, xctx) {
    if (_is_fn(xctx)) {
      xctx = xctx(g_in);}

    if (xctx && xctx.next) {
      xctx.next(g_in);
      this.on_fin(xctx);}
    return xctx} };

const ao_pipe = _ao_pipe.create;

const _evt_init = Promise.resolve({type:'init'});
function ao_dom_listen(pipe = ao_queue()) {
  let with_dom = (dom, fn) =>
    dom.addEventListener
      ? _ao_with_dom(_bind, fn, dom)
      : _ao_with_dom_vec(_bind, fn, dom);

  _bind.self = {pipe, with_dom};
  pipe.with_dom = with_dom;
  return pipe

  function _bind(dom, fn_evt, fn_dom) {
    return evt => {
      let v = fn_evt
        ? fn_evt(evt, dom, fn_dom)
        : fn_dom(dom, evt);

      if (null != v) {
        pipe.g_in.next(v);} } } }


function _ao_with_dom(_bind, fn, dom) {
  let _on_evt;
  if (_is_fn(fn)) {
    _evt_init.then(
      _on_evt = _bind(dom, void 0, fn)); }

  return {
    __proto__: _bind.self
  , listen(...args) {
      let opt, evt_fn = _on_evt;

      let last = args.pop();
      if ('function' === typeof last) {
        evt_fn = _bind(dom, last, _on_evt);
        last = args.pop();}

      if ('string' === typeof last) {
        args.push(last);}
      else opt = last;

      for (let evt of args) {
        dom.addEventListener(
          evt, evt_fn, opt); }

      return this} } }


function _ao_with_dom_vec(_bind, fn, ectx_list) {
  ectx_list = Array.from(ectx_list,
    dom => _ao_with_dom(_bind, fn, dom));

  return {
    __proto__: _bind.self
  , listen(...args) {
      for (let ectx of ectx_list) {
        ectx.listen(...args);}
      return this} } }

const ao_tgt = ao_pipe({
  * xgfold() {
    let ns = {};
    while (1) {
      let e = yield ns;
      ns[e.k] = e.v;} }

, xemit: ns =>({...ns}) });


ao_dom_listen(ao_tgt)
  .with_dom(
    document.querySelectorAll('input[type=range]')
  , (elem, evt) =>({k: elem.id, v: elem.valueAsNumber}) )
  .listen('input', 'change',);


const ao_tgt_rgb = ((async function *(){
  for await ({aaa, bbb, ccc} of ao_tgt) {
    let r = (aaa*.255).toFixed(1);
    let g = (bbb*.255).toFixed(1);
    let b = (ccc*.255).toFixed(1);
    yield `rgb(${r}, ${g}, ${b})`;} })());


const ao_tgt_hsl = ((async function *(){
  for await ({aaa, bbb, ccc} of ao_tgt) {
    let h = (aaa*0.36).toFixed(1);
    let s = (bbb/10).toFixed(1);
    let l = (ccc/10).toFixed(1);

    yield `hsl(${h}, ${s}%, ${l}%)`;} })());


{(async ()=>{
  let el_rgb = document.querySelector('#tgt_rgb');
  for await (let rgb of ao_tgt_rgb) {
    el_rgb.textContent = rgb;
    el_rgb.style.backgroundColor = rgb;} })();}

{(async ()=>{
  let el_hsl = document.querySelector('#tgt_hsl');
  for await (let hsl of ao_tgt_hsl) {
    el_hsl.textContent = hsl;
    el_hsl.style.backgroundColor = hsl;} })();}


{(async ()=>{
  for await (let e of ao_tgt) {
    console.log('ao_tgt', e); } })();}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX2lucHV0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vZG9tX2lucHV0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7XG4gIGFzc2lnbjogX29ial9hc3NpZ24sXG4gIGRlZmluZVByb3BlcnRpZXM6IF9vYmpfcHJvcHMsXG59ID0gT2JqZWN0O1xuXG5jb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBfaXNfZm4gPSB2X2ZuID0+XG4gICdmdW5jdGlvbicgPT09IHR5cGVvZiB2X2ZuXG4gICAgJiYgISBpc19hb19pdGVyKHZfZm4pO1xuY29uc3QgX3JldF9pZGVudCA9IHYgPT4gdjtcblxuY29uc3QgX3hpbnZva2UgPSB2X2ZuID0+XG4gIF9pc19mbih2X2ZuKVxuICAgID8gdl9mbigpXG4gICAgOiB2X2ZuO1xuXG5mdW5jdGlvbiBfeHBpcGVfdGd0KHBpcGUpIHtcbiAgaWYgKF9pc19mbihwaXBlKSkge1xuICAgIHBpcGUgPSBwaXBlKCk7XG4gICAgcGlwZS5uZXh0KCk7XG4gICAgcmV0dXJuIHBpcGV9XG5cbiAgcmV0dXJuIHBpcGUuZ19pbiB8fCBwaXBlfVxuZnVuY3Rpb24gKiBpdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlKGdlbl9pbik7fVxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlKGdlbl9pbik7fVxuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwsIGN0eCkge1xuICByZXR1cm4gX29ial9hc3NpZ24oY2hhaW4sIHtjaGFpbiwgdGFpbH0pXG4gIGZ1bmN0aW9uIGNoYWluKGZuKSB7XG4gICAgY2hhaW4udGFpbCA9IGZuKGNoYWluLnRhaWwsIGN0eCk7XG4gICAgcmV0dXJuIGNoYWlufSB9XG5cbmNvbnN0IGFvX2RlZmVycmVkX3YgPSAoKCgpID0+IHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBbcCwgeSwgbl0pIH0pKCkpO1xuXG5jb25zdCBhb19kZWZlcnJlZCA9IHYgPT4oXG4gIHYgPSBhb19kZWZlcnJlZF92KClcbiwge3Byb21pc2U6IHZbMF0sIHJlc29sdmU6IHZbMV0sIHJlamVjdDogdlsyXX0pO1xuXG5jb25zdCBhb19zeW1fZG9uZSA9IFN5bWJvbCgnYW9fZG9uZScpO1xuXG5mdW5jdGlvbiBhb19mZW5jZV92KCkge1xuICBsZXQgcD0wLCBfcmVzdW1lID0gKCk9Pnt9O1xuICBsZXQgX3BzZXQgPSBhID0+IF9yZXN1bWUgPSBhO1xuXG4gIHJldHVybiBbXG4gICAgKCkgPT4gMCAhPT0gcCA/IHBcbiAgICAgIDogcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuXG4gICwgdiA9PiB7cCA9IDA7IF9yZXN1bWUodik7fSBdIH1cblxuXG5cbmNvbnN0IF9hb19mZW5jZV9hcGkgPXtcbiAgc3RvcCgpIHt0aGlzLmZlbmNlLmRvbmUgPSB0cnVlO31cblxuLCBhb19mb3JrKCkge1xuICAgIHJldHVybiBhb19mZW5jZV9mb3JrKHRoaXMuZmVuY2UpfVxuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfSB9O1xuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBfb2JqX2Fzc2lnbih0Z3QsIF9hb19mZW5jZV9hcGkpO1xuICByZXR1cm4gZn1cblxuZnVuY3Rpb24gYW9fZmVuY2Vfb2JqKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX2ZuKHRndCk7XG4gIHJldHVybiB7X19wcm90b19fOiBfYW9fZmVuY2VfYXBpXG4gICwgZmVuY2U6IHRndCB8fCBmWzBdLCByZXNldDogZlsxXX0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fZmVuY2VfZm9yayhmZW5jZSkge1xuICB3aGlsZSAoISBmZW5jZS5kb25lKSB7XG4gICAgbGV0IHYgPSBhd2FpdCBmZW5jZSgpO1xuICAgIGlmIChmZW5jZS5kb25lIHx8IHYgPT09IGFvX3N5bV9kb25lKSB7XG4gICAgICByZXR1cm4gdn1cbiAgICB5aWVsZCB2O30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX2ZlbmNlX2xvb3AoZmVuY2UsIHJlc2V0LCB4Zm9ybSkge1xuICB0cnkge1xuICAgIGxldCB2O1xuICAgIHdoaWxlICghIGZlbmNlLmRvbmUpIHtcbiAgICAgIHYgPSBhd2FpdCBmZW5jZSgpO1xuICAgICAgaWYgKHYgPT09IGFvX3N5bV9kb25lKSB7XG4gICAgICAgIHJldHVybn1cblxuICAgICAgdiA9IHlpZWxkIHY7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zm9ybSkge1xuICAgICAgICB2ID0gYXdhaXQgeGZvcm0odik7fVxuICAgICAgcmVzZXQodik7IH0gfVxuICBmaW5hbGx5IHtcbiAgICByZXNldChhb19zeW1fZG9uZSk7fSB9XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4sIG5vdGlmeT1fcmV0X2lkZW50KSB7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoZ2VuX2luKSkge1xuICAgIG5vdGlmeSh2KTt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIHhmb3JtPV9yZXRfaWRlbnQpIHtcbiAgZ2VuX3RndCA9IF94cGlwZV90Z3QoZ2VuX3RndCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoZ2VuX2luKSkge1xuICAgIGlmICh1bmRlZmluZWQgIT09IGdlbl90Z3QpIHtcbiAgICAgIHYgPSB4Zm9ybSh2KTtcbiAgICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgICBpZiAoZG9uZSkge2JyZWFrfSB9IH0gfVxuXG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgbXVsdGlwbGUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAobXVsdGlwbGUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuZnVuY3Rpb24gYW9fZm9yaygpIHtcbiAgcmV0dXJuIGFvX2ZlbmNlX2ZvcmsodGhpcy5mZW5jZSl9XG5cbmNvbnN0IF9hb190YXBfcHJvcHMgPXtcbiAgYW9fZm9yazp7dmFsdWU6IGFvX2Zvcmt9XG4sIGNoYWluOntnZXQoKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfSB9IH07XG5cbmZ1bmN0aW9uIGFvX3RhcChhZ19vdXQpIHtcbiAgcmV0dXJuIF9vYmpfcHJvcHMoX2FvX3RhcChhZ19vdXQpLCBfYW9fdGFwX3Byb3BzKSB9XG5cbmZ1bmN0aW9uIF9hb190YXAoYWdfb3V0KSB7XG4gIGxldCBbZmVuY2UsIHJlc2V0XSA9IGFvX2ZlbmNlX3YoKTtcbiAgbGV0IGdlbiA9ICgoYXN5bmMgZnVuY3Rpb24gKiAoKSB7XG4gICAgZmVuY2UuZG9uZSA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlKGFnX291dCkpIHtcbiAgICAgICAgcmVzZXQodik7XG4gICAgICAgIHlpZWxkIHY7fSB9XG4gICAgZmluYWxseSB7XG4gICAgICBmZW5jZS5kb25lID0gdHJ1ZTtcbiAgICAgIHJlc2V0KCk7fSB9KS5jYWxsKHRoaXMpKTtcblxuICBnZW4uZmVuY2UgPSBmZW5jZTtcbiAgcmV0dXJuIGdlbn1cblxuXG5cbmNvbnN0IF9hb19zcGxpdF9hcGkgPXtcbiAgZ2V0IGNoYWluKCkge1xuICAgIHJldHVybiBmbl9jaGFpbih0aGlzLCB0aGlzKX1cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTogYW9fZm9ya1xuLCBhb19mb3JrfTtcblxuZnVuY3Rpb24gYW9fc3BsaXQoYWdfb3V0KSB7XG4gIGxldCBnZW4gPSBfYW9fdGFwKGFnX291dCk7XG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYW9fc3BsaXRfYXBpXG4gICwgZmluOiBhb19ydW4oZ2VuKVxuICAsIGZlbmNlOiBnZW4uZmVuY2V9IH1cblxuZnVuY3Rpb24gYW9fcXVldWUoeGZvcm0pIHtcbiAgbGV0IFtmZW5jZSwgb3V0X3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCBbaW5fZmVuY2UsIGluX3Jlc2V0XSA9IGFvX2ZlbmNlX3YoKTtcblxuICBsZXQgYWdfb3V0ID0gX2FvX2ZlbmNlX2xvb3AoZmVuY2UsIGluX3Jlc2V0KTtcbiAgbGV0IGdfaW4gPSBfYW9fZmVuY2VfbG9vcChpbl9mZW5jZSwgb3V0X3Jlc2V0LCB4Zm9ybSk7XG5cbiAgLy8gYWxsb3cgZ19pbiB0byBpbml0aWFsaXplXG4gIGdfaW4ubmV4dCgpIDsgaW5fcmVzZXQoKTtcbiAgcmV0dXJuIF9vYmpfYXNzaWduKGFnX291dCwge2ZlbmNlLCBnX2lufSkgfVxuXG5jb25zdCBfYXNfcGlwZV9lbmQgPSAoZyxucykgPT4gX29ial9hc3NpZ24oZywgbnMpO1xuXG4vL35+flxuLy8gUGlwZSBiYXNlIGFzIGdlbmVyYXRvciBpbiBjb21wb3NlZCBvYmplY3QtZnVuY3Rpb25hbCBpbXBsZW1lbnRhdGlvblxuXG5jb25zdCBfYW9fcGlwZV9iYXNlID17XG4gIHhmb2xkOiB2ID0+IHYgLy8gb24gcHVzaDogaWRlbnRpdHkgdHJhbnNmb3JtXG4sIHhwdWxsKCkge30gLy8gbWVtb3J5OiBub25lXG4sIHhlbWl0OiBfeGludm9rZSAvLyBpZGVudGl0eSB0cmFuc2Zvcm0gb3IgaW52b2tlIGlmIGZ1bmN0aW9uXG4sIHhpbml0KGdfaW4sIGFnX291dCkge30gLy8gb24gaW5pdDogZGVmYXVsdCBiZWhhdmlvclxuXG4sIGdldCBjcmVhdGUoKSB7XG4gICAgLy8gYXMgZ2V0dGVyIHRvIGJpbmQgY2xhc3MgYXMgYHRoaXNgIGF0IGFjY2VzcyB0aW1lXG4gICAgY29uc3QgY3JlYXRlID0gKC4uLiBhcmdzKSA9PlxuICAgICAgX29ial9hc3NpZ24oe19fcHJvdG9fXzogdGhpc30sXG4gICAgICAgIC4uLiBhcmdzLm1hcChfeGludm9rZSkpXG4gICAgICAuX2FvX3BpcGUoKTtcblxuICAgIHJldHVybiBjcmVhdGUuY3JlYXRlID0gY3JlYXRlfVxuXG4sIF9hb19waXBlKCkge1xuICAgIGxldCBmaW5fbHN0ID0gW107XG5cbiAgICBsZXQgb25fZmluID0gdGhpcy5vbl9maW4gPVxuICAgICAgZyA9PihmaW5fbHN0LnB1c2goZyksIGcpO1xuXG4gICAgbGV0IHN0b3AgPSB0aGlzLnN0b3AgPSAoKCkgPT4ge1xuICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcbiAgICAgIF9maW5fcGlwZShmaW5fbHN0KTtcbiAgICAgIHRoaXMuX3Jlc3VtZSgpO30pO1xuXG5cbiAgICBsZXQgZ19pbiA9IG9uX2ZpbihcbiAgICAgIHRoaXMuX2FvX3BpcGVfaW4oKSk7XG5cbiAgICBsZXQgYWdfb3V0ID0gb25fZmluKFxuICAgICAgdGhpcy5fYW9fcGlwZV9vdXQoKSk7XG5cbiAgICAvLyBhZGFwdCBhZ19vdXQgYnkgYXBpIGFuZCBraW5kXG4gICAgbGV0IHNlbGYgPSB7c3RvcCwgb25fZmluLCBnX2lufTtcbiAgICBhZ19vdXQgPSB0aGlzLl9hc19waXBlX291dChcbiAgICAgIGFnX291dCwgc2VsZiwgdGhpcy5raW5kKTtcblxuICAgIGFnX291dCA9IHRoaXMueGluaXQoZ19pbiwgYWdfb3V0KSB8fCBhZ19vdXQ7XG5cbiAgICAvLyBhbGxvdyBnX2luIHRvIGluaXRpYWxpemVcbiAgICBnX2luLm5leHQoKTtcbiAgICByZXR1cm4gYWdfb3V0fVxuXG4sIF9hc19waXBlX291dDogX2FzX3BpcGVfZW5kXG5cbiwgLy9+fn5cbiAgLy8gVXBzdHJlYW0gaW5wdXQgZ2VuZXJhdG9yXG4gIC8vICAgZGVzaWduZWQgZm9yIG11bHRpcGxlIGZlZWRlcnNcblxuICAqX2FvX3BpcGVfaW4oKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCB2O1xuICAgICAgd2hpbGUgKCEgdGhpcy5kb25lKSB7XG4gICAgICAgIHYgPSB0aGlzLnhmb2xkKHlpZWxkIHYpO1xuICAgICAgICB0aGlzLnZhbHVlID0gdjtcbiAgICAgICAgaWYgKDAgIT09IHRoaXMuX3dhaXRpbmcgJiYgdW5kZWZpbmVkICE9PSB2KSB7XG4gICAgICAgICAgdGhpcy5fcmVzdW1lKCk7fSB9IH1cblxuICAgIGZpbmFsbHkge1xuICAgICAgdGhpcy5zdG9wKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBEb3duc3RyZWFtIGFzeW5jIG91dHB1dCBnZW5lcmF0b3JcbiAgLy8gICBkZXNpZ25lZCBmb3Igc2luZ2xlIGNvbnN1bWVyLlxuXG4gIGFzeW5jICpfYW9fcGlwZV9vdXQoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCByO1xuICAgICAgd2hpbGUgKCEgdGhpcy5kb25lKSB7XG4gICAgICAgIGlmICgwICE9PSAociA9IHRoaXMuX3dhaXRpbmcpKSB7XG4gICAgICAgICAgLy8gcDA6IGV4aXN0aW5nIHdhaXRlcnNcbiAgICAgICAgICByID0gYXdhaXQgcjtcbiAgICAgICAgICBpZiAodGhpcy5kb25lKSB7YnJlYWt9IH1cbiAgICAgICAgZWxzZSBpZiAodW5kZWZpbmVkICE9PSAociA9IHRoaXMudmFsdWUpKSB7XG4gICAgICAgICAgLy8gcDE6IGF2YWlsYWJsZSB2YWx1ZVxuICAgICAgICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7fVxuICAgICAgICBlbHNlIGlmICh1bmRlZmluZWQgIT09IChyID0gdGhpcy54cHVsbCgpKSkge1xuICAgICAgICAgIH0vLyBwMjogeHB1bGwgdmFsdWUgKGUuZy4gcXVldWUgbWVtb3J5KSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gcDM6IGFkZCBuZXcgd2FpdGVyXG4gICAgICAgICAgciA9IGF3YWl0IHRoaXMuX2JpbmRfd2FpdGluZygpO1xuICAgICAgICAgIGlmICh0aGlzLmRvbmUpIHticmVha30gfVxuXG4gICAgICAgIHlpZWxkIHRoaXMueGVtaXQocik7fSB9XG5cbiAgICBmaW5hbGx5IHtcbiAgICAgIHRoaXMuc3RvcCgpO30gfVxuXG5cbiwgLy9+fn5cbiAgLy8gZ2VuZXJhdG9yLWxpa2UgdmFsdWUvZG9uZSBzdGF0ZXNcblxuICB2YWx1ZTogdW5kZWZpbmVkXG4sIGRvbmU6IGZhbHNlXG5cbiwgLy9+fn5cbiAgLy8gcHJvbWlzZS1iYXNlZCBmZW5jZSB0YWlsb3JlZCBmb3IgYW9fcGlwZSB1c2VjYXNlXG5cbiAgX3dhaXRpbmc6IDBcbiwgX2Z1bGZpbGwoKSB7fVxuLCBhc3luYyBfcmVzdW1lKCkge1xuICAgIGlmICghIHRoaXMuZG9uZSkge2F3YWl0IHRoaXM7fVxuXG4gICAgbGV0IHt2YWx1ZSwgX2Z1bGZpbGx9ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkICE9IHZhbHVlIHx8IHRoaXMuZG9uZSkge1xuICAgICAgdGhpcy52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSAwO1xuICAgICAgX2Z1bGZpbGwodmFsdWUpO30gfVxuXG4sIF9iaW5kX3dhaXRpbmcoKSB7XG4gICAgbGV0IF9yZXNldCA9IHkgPT4gdGhpcy5fZnVsZmlsbCA9IHk7XG4gICAgdGhpcy5fYmluZF93YWl0aW5nID0gKCkgPT4gdGhpcy5fd2FpdGluZyB8fChcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSBuZXcgUHJvbWlzZShfcmVzZXQpKTtcbiAgICByZXR1cm4gdGhpcy5fYmluZF93YWl0aW5nKCl9IH07XG5cblxuZnVuY3Rpb24gX2Zpbl9waXBlKGZpbl9sc3QpIHtcbiAgd2hpbGUgKDAgIT09IGZpbl9sc3QubGVuZ3RoKSB7XG4gICAgbGV0IGcgPSBmaW5fbHN0LnBvcCgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoX2lzX2ZuKGcpKSB7ZygpO31cbiAgICAgIGVsc2UgZy5yZXR1cm4oKTt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvcikge1xuICAgICAgICBpZiAoJ0dlbmVyYXRvciBpcyBhbHJlYWR5IHJ1bm5pbmcnID09PSBlcnIubWVzc2FnZSkge1xuICAgICAgICAgIGNvbnRpbnVlfSB9XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7fSB9IH1cblxuY29uc3QgX2FvX3BpcGVfb3V0X2tpbmRzID17XG4gIGFvX3JhdzogZyA9PiBnXG4sIGFvX3NwbGl0OiBhb19zcGxpdFxuLCBhb190YXA6IGFvX3RhcH07XG5cbmZ1bmN0aW9uIF9hb19waXBlX291dChhZ19vdXQsIHNlbGYsIGtpbmQpIHtcbiAga2luZCA9IC9eYW9fLy50ZXN0KGtpbmQpID8ga2luZCA6ICdhb18nK2tpbmQ7XG4gIGxldCBhb193cmFwID0gX2FvX3BpcGVfb3V0X2tpbmRzW2tpbmRdO1xuICBpZiAodW5kZWZpbmVkID09PSBhb193cmFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub253biBhb19waXBlX291dCBraW5kIFwiJHtraW5kfVwiYCl9XG5cbiAgcmV0dXJuIF9vYmpfYXNzaWduKGFvX3dyYXAoYWdfb3V0KSwgc2VsZikgfVxuXG5jb25zdCBfYW9fcGlwZSA9e1xuICBfX3Byb3RvX186IF9hb19waXBlX2Jhc2VcblxuLCAvLyB4Zm9sZDogdiA9PiB2IC0tIG9uIHB1c2g6IGlkZW50aXR5IHRyYW5zZm9ybVxuICAvLyB4cHVsbCgpIHt9IC0tIG1lbW9yeTogbm9uZVxuICAvLyB4ZW1pdDogX3hpbnZva2UgLS0gaWRlbnRpdHkgdHJhbnNmb3JtIG9yIGludm9rZSBpZiBmdW5jdGlvblxuXG4gIC8vICp4Z2ZvbGQoKSAtLSBvbiBwdXNoOiBnZW5lcmF0b3ItYmFzZWQgZm9sZCBpbXBsXG4gIC8vICp4c3JjKCkgLS0gZmVlZCB3aXRoIHNvdXJjZSBnZW5lcmF0b3JcbiAgLy8gKnhjdHgoZ2VuX3NyYykgLS0gb24gaW5pdDogYmluZCBldmVudCBzb3VyY2VzXG5cbiAga2luZDogJ3NwbGl0J1xuLCAvL19hc19waXBlX2luOiBfYW9fcGlwZV9pblxuICBfYXNfcGlwZV9vdXQ6IF9hb19waXBlX291dFxuXG4sIHhpbml0KGdfaW4sIGFnX291dCkge1xuICAgIGxldCB4Z2ZvbGQgPSB0aGlzLnhnZm9sZDtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Z2ZvbGQpIHtcbiAgICAgIHRoaXMuX2luaXRfeGdmb2xkKGdfaW4sIHhnZm9sZCk7fVxuXG4gICAgdGhpcy5faW5pdF9jaGFpbihnX2luKTt9XG5cblxuLCBfaW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKSB7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0geGdmb2xkKSB7XG4gICAgICByZXR1cm59XG5cbiAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgIHhnZm9sZCA9IHhnZm9sZC5jYWxsKHRoaXMsIHRoaXMpO1xuXG4gICAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgICAgdGhpcy54Zm9sZCA9IHhnZm9sZDtcbiAgICAgICAgcmV0dXJuIHRydWV9XG5cbiAgICAgIHhnZm9sZC5uZXh0KCk7fVxuXG4gICAgdGhpcy54Z2ZvbGQgPSB4Z2ZvbGQ7XG4gICAgdGhpcy54Zm9sZCA9IHRoaXMuX2ZvbGRfZ2VuO1xuICAgIHRoaXMub25fZmluKHhnZm9sZCk7XG4gICAgcmV0dXJuIHRydWV9XG5cbiwgX2ZvbGRfZ2VuKHYpIHtcbiAgICBsZXQge2RvbmUsIHZhbHVlfSA9IHRoaXMueGdmb2xkLm5leHQodik7XG4gICAgaWYgKGRvbmUpIHt0aGlzLmRvbmUgPSB0cnVlO31cbiAgICByZXR1cm4gdmFsdWV9XG5cblxuLCBfaW5pdF9jaGFpbihnX2luKSB7XG4gICAgbGV0IHt4c3JjLCB4Y3R4fSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geHNyYykge1xuICAgICAgYW9fZHJpdmUoeHNyYywgZ19pbilcbiAgICAgICAgLnRoZW4gKCgpID0+Z19pbi5yZXR1cm4oKSk7IH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhjdHgpIHtcbiAgICAgIHRoaXMuX3dpdGhfY3R4KGdfaW4sIHhjdHgpO30gfVxuXG4sIF93aXRoX2N0eChnX2luLCB4Y3R4KSB7XG4gICAgaWYgKF9pc19mbih4Y3R4KSkge1xuICAgICAgeGN0eCA9IHhjdHgoZ19pbik7fVxuXG4gICAgaWYgKHhjdHggJiYgeGN0eC5uZXh0KSB7XG4gICAgICB4Y3R4Lm5leHQoZ19pbik7XG4gICAgICB0aGlzLm9uX2Zpbih4Y3R4KTt9XG4gICAgcmV0dXJuIHhjdHh9IH07XG5cbmNvbnN0IGFvX3BpcGUgPSBfYW9fcGlwZS5jcmVhdGU7XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDApIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc2V0LCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2ZlbmNlLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBnZW5faW4pIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLmZpbiA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIGxldCBwO1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoZ2VuX2luKSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICBpZiAoX2ZlbmNlLmRvbmUpIHtyZXR1cm59XG4gICAgICBwID0gX2ZlbmNlKCk7XG4gICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIHYpO31cblxuICAgIGF3YWl0IHA7XG4gICAgX2ZlbmNlLmRvbmUgPSB0cnVlO30pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhnZW5faW4pIHtcbiAgbGV0IHRzMCA9IERhdGUubm93KCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgeWllbGQgRGF0ZS5ub3coKSAtIHRzMDt9IH1cblxuZnVuY3Rpb24gYW9fZG9tX2FuaW1hdGlvbigpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcbiAgcmV0dXJuIHJhZlxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc2V0KTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihwaXBlID0gYW9fcXVldWUoKSkge1xuICBsZXQgd2l0aF9kb20gPSAoZG9tLCBmbikgPT5cbiAgICBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICA6IF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBkb20pO1xuXG4gIF9iaW5kLnNlbGYgPSB7cGlwZSwgd2l0aF9kb219O1xuICBwaXBlLndpdGhfZG9tID0gd2l0aF9kb207XG4gIHJldHVybiBwaXBlXG5cbiAgZnVuY3Rpb24gX2JpbmQoZG9tLCBmbl9ldnQsIGZuX2RvbSkge1xuICAgIHJldHVybiBldnQgPT4ge1xuICAgICAgbGV0IHYgPSBmbl9ldnRcbiAgICAgICAgPyBmbl9ldnQoZXZ0LCBkb20sIGZuX2RvbSlcbiAgICAgICAgOiBmbl9kb20oZG9tLCBldnQpO1xuXG4gICAgICBpZiAobnVsbCAhPSB2KSB7XG4gICAgICAgIHBpcGUuZ19pbi5uZXh0KHYpO30gfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pIHtcbiAgbGV0IF9vbl9ldnQ7XG4gIGlmIChfaXNfZm4oZm4pKSB7XG4gICAgX2V2dF9pbml0LnRoZW4oXG4gICAgICBfb25fZXZ0ID0gX2JpbmQoZG9tLCB2b2lkIDAsIGZuKSk7IH1cblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBsZXQgb3B0LCBldnRfZm4gPSBfb25fZXZ0O1xuXG4gICAgICBsZXQgbGFzdCA9IGFyZ3MucG9wKCk7XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgZXZ0X2ZuID0gX2JpbmQoZG9tLCBsYXN0LCBfb25fZXZ0KTtcbiAgICAgICAgbGFzdCA9IGFyZ3MucG9wKCk7fVxuXG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGFyZ3MucHVzaChsYXN0KTt9XG4gICAgICBlbHNlIG9wdCA9IGxhc3Q7XG5cbiAgICAgIGZvciAobGV0IGV2dCBvZiBhcmdzKSB7XG4gICAgICAgIGRvbS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIGV2dCwgZXZ0X2ZuLCBvcHQpOyB9XG5cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZWN0eF9saXN0KSB7XG4gIGVjdHhfbGlzdCA9IEFycmF5LmZyb20oZWN0eF9saXN0LFxuICAgIGRvbSA9PiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pKTtcblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBmb3IgKGxldCBlY3R4IG9mIGVjdHhfbGlzdCkge1xuICAgICAgICBlY3R4Lmxpc3RlbiguLi5hcmdzKTt9XG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cbmV4cG9ydCB7IF9hb19mZW5jZV9sb29wLCBfYW9fcGlwZSwgX2FvX3BpcGVfYmFzZSwgX2FvX3BpcGVfb3V0LCBfYW9fcGlwZV9vdXRfa2luZHMsIF9hb190YXAsIF94aW52b2tlLCBfeHBpcGVfdGd0LCBhb19kZWJvdW5jZSwgYW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3YsIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9saXN0ZW4sIGFvX2RyaXZlLCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfZm9yaywgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV92LCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9fcGlwZSwgYW9fcXVldWUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fc3ltX2RvbmUsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGZuX2NoYWluLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiaW1wb3J0IHthb19waXBlLCBhb19kb21fbGlzdGVufSBmcm9tICdyb2FwJ1xuXG5jb25zdCBhb190Z3QgPSBhb19waXBlIEA6XG4gICogeGdmb2xkKCkgOjpcbiAgICBsZXQgbnMgPSB7fVxuICAgIHdoaWxlIDEgOjpcbiAgICAgIGxldCBlID0geWllbGQgbnNcbiAgICAgIG5zW2Uua10gPSBlLnZcblxuICB4ZW1pdDogbnMgPT4gQDogLi4ubnNcblxuXG5hb19kb21fbGlzdGVuKGFvX3RndClcbiAgLndpdGhfZG9tIEBcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFt0eXBlPXJhbmdlXScpXG4gICAgKGVsZW0sIGV2dCkgPT4gQDogazogZWxlbS5pZCwgdjogZWxlbS52YWx1ZUFzTnVtYmVyXG4gIC5saXN0ZW4gQCAnaW5wdXQnLCAnY2hhbmdlJyxcblxuXG5jb25zdCBhb190Z3RfcmdiID0gQCo+XG4gIGZvciBhd2FpdCB7YWFhLCBiYmIsIGNjY30gb2YgYW9fdGd0IDo6XG4gICAgbGV0IHIgPSAoYWFhKi4yNTUpLnRvRml4ZWQoMSlcbiAgICBsZXQgZyA9IChiYmIqLjI1NSkudG9GaXhlZCgxKVxuICAgIGxldCBiID0gKGNjYyouMjU1KS50b0ZpeGVkKDEpXG4gICAgeWllbGQgYHJnYigke3J9LCAke2d9LCAke2J9KWBcbiAgICAgIFxuXG5jb25zdCBhb190Z3RfaHNsID0gQCo+XG4gIGZvciBhd2FpdCB7YWFhLCBiYmIsIGNjY30gb2YgYW9fdGd0IDo6XG4gICAgbGV0IGggPSAoYWFhKjAuMzYpLnRvRml4ZWQoMSlcbiAgICBsZXQgcyA9IChiYmIvMTApLnRvRml4ZWQoMSlcbiAgICBsZXQgbCA9IChjY2MvMTApLnRvRml4ZWQoMSlcbiAgICBcbiAgICB5aWVsZCBgaHNsKCR7aH0sICR7c30lLCAke2x9JSlgXG5cblxuOjohPlxuICBsZXQgZWxfcmdiID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RndF9yZ2InKVxuICBmb3IgYXdhaXQgbGV0IHJnYiBvZiBhb190Z3RfcmdiIDo6XG4gICAgZWxfcmdiLnRleHRDb250ZW50ID0gcmdiXG4gICAgZWxfcmdiLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHJnYlxuXG46OiE+XG4gIGxldCBlbF9oc2wgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGd0X2hzbCcpXG4gIGZvciBhd2FpdCBsZXQgaHNsIG9mIGFvX3RndF9oc2wgOjpcbiAgICBlbF9oc2wudGV4dENvbnRlbnQgPSBoc2xcbiAgICBlbF9oc2wuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gaHNsXG5cblxuOjohPlxuICBmb3IgYXdhaXQgbGV0IGUgb2YgYW9fdGd0IDo6XG4gICAgY29uc29sZS5sb2cgQCAnYW9fdGd0JywgZVxuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTTtBQUNOLEVBQUUsTUFBTSxFQUFFLFdBQVc7QUFDckIsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVO0FBQzlCLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDWDtBQUNBLE1BQU0sVUFBVSxHQUFHLENBQUM7QUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztBQUNBLE1BQU0sTUFBTSxHQUFHLElBQUk7QUFDbkIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0FBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQjtBQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7QUFDckIsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ2QsTUFBTSxJQUFJLEVBQUU7QUFDWixNQUFNLElBQUksQ0FBQztBQUNYO0FBQ0EsU0FBUyxVQUFVLENBQUMsSUFBSSxFQUFF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LFFBQVEsQ0FBQyxDQUFDO0FBQ2hDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFDM0IsRUFBRSxPQUFPLElBQUk7QUFDYjtBQUNBLEVBQUUsU0FBUyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDdEMsSUFBSSxPQUFPLEdBQUcsSUFBSTtBQUNsQixNQUFNLElBQUksQ0FBQyxHQUFHLE1BQU07QUFDcEIsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUM7QUFDbEMsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzNCO0FBQ0EsTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7QUFDckIsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFO0FBQ2pDO0FBQ0E7QUFDQSxTQUFTLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRTtBQUN0QyxFQUFFLElBQUksT0FBTyxDQUFDO0FBQ2QsRUFBRSxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUNsQixJQUFJLFNBQVMsQ0FBQyxJQUFJO0FBQ2xCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFDO0FBQ0EsRUFBRSxPQUFPO0FBQ1QsSUFBSSxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUk7QUFDekIsSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFDcEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxNQUFNLEdBQUcsT0FBTyxDQUFDO0FBQ2hDO0FBQ0EsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDNUIsTUFBTSxJQUFJLFVBQVUsS0FBSyxPQUFPLElBQUksRUFBRTtBQUN0QyxRQUFRLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMzQyxRQUFRLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUMzQjtBQUNBLE1BQU0sSUFBSSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7QUFDcEMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDekIsV0FBVyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ3RCO0FBQ0EsTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtBQUM1QixRQUFRLEdBQUcsQ0FBQyxnQkFBZ0I7QUFDNUIsVUFBVSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDOUI7QUFDQSxNQUFNLE9BQU8sSUFBSSxDQUFDLEVBQUUsRUFBRTtBQUN0QjtBQUNBO0FBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRTtBQUNoRCxFQUFFLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVM7QUFDbEMsSUFBSSxHQUFHLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6QztBQUNBLEVBQUUsT0FBTztBQUNULElBQUksU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJO0FBQ3pCLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQ3BCLE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7QUFDbEMsUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUM5QixNQUFNLE9BQU8sSUFBSSxDQUFDLEVBQUU7O0FDamdCcEI7RUFDRTtJQUNFO1dBQ0s7TUFDSDtNQUNBOztFQUVKLGNBQWU7OztBQUdqQjs7SUFFSSwwQkFBMEIsbUJBQW1CO0lBQzdDLGdCQUFpQjtVQUNULE9BQU8sRUFBRSxRQUFROzs7QUFHN0I7YUFDWTtJQUNSO0lBQ0E7SUFDQTtJQUNBLE1BQU0sT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUU7OztBQUcvQjthQUNZO0lBQ1I7SUFDQTtJQUNBOztJQUVBLE1BQU0sT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUU7Ozs7RUFJOUIsb0NBQW9DLFVBQVU7YUFDckM7SUFDUDtJQUNBOzs7RUFHRixvQ0FBb0MsVUFBVTthQUNyQztJQUNQO0lBQ0E7Ozs7YUFJTztJQUNQLFlBQWEsUUFBUyJ9
