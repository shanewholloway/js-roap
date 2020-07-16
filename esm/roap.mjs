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
function * iter(gen_in) {
  yield * _xinvoke(gen_in);}
async function * ao_iter(gen_in) {
  yield * _xinvoke(gen_in);}


function fn_chain(tail, ctx) {
  return _obj_assign(chain, {chain, tail})
  function chain(fn) {
    chain.tail = fn(chain.tail, ctx);
    return chain} }

const ao_deferred_v = ((() => {
  let y,n,_pset = (a,b) => { y=a, n=b; };
  return p =>(
    p = new Promise(_pset)
  , [p, y, n]) })());

const ao_deferred = v =>(
  v = ao_deferred_v()
, {promise: v[0], resolve: v[1], reject: v[2]});

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

function ao_fence_obj(tgt) {
  let f = ao_fence_fn(tgt);
  return {__proto__: _ao_fence_api
  , fence: tgt || f[0], reset: f[1]} }


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


function ao_step_iter(iterable, multiple) {
  iterable = ao_iter(iterable);
  return {
    async * [Symbol.asyncIterator]() {
      do {
        let {value} = await iterable.next();
        yield value;}
      while (multiple) } } }


function step_iter(iterable, multiple) {
  iterable = iter(iterable);
  return {
    *[Symbol.iterator]() {
      do {
        let {value} = iterable.next();
        yield value;}
      while (multiple) } } }

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

function ao_interval(ms=1000) {
  let [_fence, _reset] = ao_fence_fn();
  let tid = setInterval(_reset, ms, 1);
  if (tid.unref) {tid.unref();}
  _fence.stop = (() => {
    tid = clearInterval(tid);
    _fence.done = true;});
  return _fence}


function ao_timeout(ms=1000) {
  let tid, [_fence, _reset] = ao_fence_fn(timeout);
  return timeout

  function timeout() {
    tid = setTimeout(_reset, ms, 1);
    if (tid.unref) {tid.unref();}
    return _fence()} }


function ao_debounce(ms=300, gen_in) {
  let tid, [_fence, _reset] = ao_fence_fn();

  _fence.fin = ((async () => {
    let p;
    for await (let v of _xinvoke(gen_in)) {
      clearTimeout(tid);
      if (_fence.done) {return}
      p = _fence();
      tid = setTimeout(_reset, ms, v);}

    await p;
    _fence.done = true;})());

  return _fence}


async function * ao_times(gen_in) {
  let ts0 = Date.now();
  for await (let v of gen_in) {
    yield Date.now() - ts0;} }

function ao_dom_animation() {
  let tid, [_fence, _reset] = ao_fence_fn(raf);
  raf.stop = (() => {
    tid = cancelAnimationFrame(tid);
    raf.done = true;});
  return raf

  function raf() {
    tid = requestAnimationFrame(_reset);
    return _fence()} }

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

export { _ao_fence_loop, _ao_pipe, _ao_pipe_base, _ao_pipe_out, _ao_pipe_out_kinds, _ao_tap, _xinvoke, _xpipe_tgt, ao_debounce, ao_deferred, ao_deferred_v, ao_dom_animation, ao_dom_listen, ao_drive, ao_fence_fn, ao_fence_fork, ao_fence_obj, ao_fence_v, ao_interval, ao_iter, ao_pipe, ao_queue, ao_run, ao_split, ao_step_iter, ao_sym_done, ao_tap, ao_timeout, ao_times, fn_chain, is_ao_iter, iter, step_iter };
//# sourceMappingURL=roap.mjs.map
