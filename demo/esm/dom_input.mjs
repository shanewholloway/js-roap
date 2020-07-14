const {
  assign: _obj_assign,
  defineProperties: _obj_props,
} = Object;

const {
  isArray: _is_array,
} = Array;

const is_ao_iter = g =>
  null != g[Symbol.asyncIterator];

const _is_fn = v_fn =>
  'function' === typeof v_fn
    && ! is_ao_iter(v_fn);
const _ret_ident = v => v;

const _xinvoke$1 = v_fn =>
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
  return _obj_assign(chain,{
    chain, tail: _xinvoke$1(tail)} )

  function chain(fn) {
    chain.tail = fn(chain.tail, ctx);
    return chain} }


function _wm_pipe_closure(wm_absent) {
  let wm = new WeakMap();
  return pipe =>
    _wm_item(wm,
      pipe.g_in || pipe,
      wm_absent) }

function _wm_item(wm, wm_key, wm_absent) {
  let item = wm.get(wm_key);
  if (undefined === item) {
    item = wm_absent(wm_key);
    wm.set(wm_key, item);}
  return item}

function ao_fence_v() {
  let p=0, _resume = ()=>{};
  let _pset = a => _resume = a;

  return [
    () => 0 !== p ? p
      : p = new Promise(_pset)

  , v => {p = 0; _resume(v);} ] }


async function * ao_fence_fork(fence) {
  while (! fence.done) {
    let v = await fence();
    if (fence.done) {
      return v}
    yield v;} }


// export async function * ao_fence_marks(fence, opt) ::
//   let {signal, trailing, initial} = opt || {}
//   let f = true === initial
//     ? fence() : initial
//
//   while ! fence.done ::
//     let v
//     if trailing ::
//       v = await f
//       f = fence()
//
//     else ::
//       f = fence()
//       v = await f
//
//     if fence.done ::
//       return v
//
//     if _is_fn(signal) ::
//       yield signal(v)
//     else if signal ::
//       yield signal
//     else yield v

async function ao_run(gen_in, notify=_ret_ident) {
  for await (let v of _xinvoke$1(gen_in)) {
    notify(v);} }


async function ao_drive(gen_in, gen_tgt, xform=_ret_ident) {
  gen_tgt = _xpipe_tgt(gen_tgt);
  for await (let v of _xinvoke$1(gen_in)) {
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
      for await (let v of _xinvoke$1(ag_out)) {
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

const _as_pipe_end = (g,ns) => _obj_assign(g, ns);

//~~~
// Pipe base as generator in composed object-functional implementation

const _ao_pipe_base ={
  xfold: v => v // on push: identity transform
, xpull() {} // memory: none
, xemit: _xinvoke$1 // identity transform or invoke if function
, xinit(g_in, ag_out) {} // on init: default behavior

, get create() {
    // as getter to bind class as `this` at access time
    const create = (... args) =>
      _obj_assign({__proto__: this},
        ... args.map(_xinvoke$1))
      ._ao_pipe();

    return create.create = create}

, _ao_pipe() {
    let fin_lst = [];
    let self ={
      on_fin: g =>(
        fin_lst.push(g)
      , g)

    , stop: (() => {
        this.done = true;
        _fin_pipe(fin_lst);
        this._resume();}) };

    let {kind} = this;
    let g_in = self.on_fin(this._ao_pipe_in(self.stop));
    let ag_out = self.on_fin(this._ao_pipe_out(self.stop));

    self.g_in = g_in = this._as_pipe_in(g_in, self, kind);
    ag_out = this._as_pipe_out(ag_out, self, kind);

    this.xinit(g_in, ag_out);

    // allow g_in to initialize
    g_in.next();
    return ag_out}

, _as_pipe_in: _as_pipe_end
, _as_pipe_out: _as_pipe_end

, //~~~
  // Upstream input generator
  //   designed for multiple feeders

  *_ao_pipe_in(_finish) {
    try {
      let v;
      while (! this.done) {
        v = this.xfold(yield v);
        this.value = v;
        if (0 !== this._waiting && undefined !== v) {
          this._resume();} } }

    finally {
      _finish();} }


, //~~~
  // Downstream async output generator
  //   designed for single consumer.

  async *_ao_pipe_out(_finish) {
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
      _finish();} }


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

const _ao_pipe_in_api ={
  as_pipe_in(self, g_in) {}

, with_ctx(xctx) {
    if (_is_fn(xctx)) {
      xctx = xctx(this);}

    if (xctx && xctx.next) {
      xctx.next(this);
      this.on_fin(xctx);}
    return xctx}

, feed(xsrc, xform) {
    return ao_drive(xsrc, this, xform)}

, bind_vec(... keys) {
    return v => this.next([...keys, v]) }

, bind_obj(key, ns) {
    return v => this.next({...ns, [key]: v}) } };

function _ao_pipe_in(g_in, self) {
  return _obj_assign(g_in, _ao_pipe_in_api, self)}

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
, _as_pipe_in: _ao_pipe_in
, _as_pipe_out: _ao_pipe_out

, xinit(g_in) {
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
    g_in.on_fin(xgfold);
    return true}

, _fold_gen(v) {
    let {done, value} = this.xgfold.next(v);
    if (done) {this.done = true;}
    return value}


, _init_chain(g_in) {
    let {xsrc, xctx} = this;
    if (undefined !== xsrc) {
      g_in.feed(xsrc)
        .then (() =>g_in.return()); }

    if (undefined !== xctx) {
      g_in.with_ctx(xctx);} } };


const ao_pipe = _ao_pipe.create;

const ao_dom_events =
  _wm_pipe_closure(_ao_dom_events_ctx);

function _ao_dom_events_ctx(g_in) {
  return {__proto__: _dom_events_api
  , wm_elems: new WeakMap()
  , emit: info => g_in.next(info)} }


const _dom_events_api ={
  // wm_elems: new WeakMap()
  // emit: info => g_in.next(info)

  listen(elem, evt, xfn, evt_opt) {
    let {emit, info} = this;
     {
      let em = _wm_item(this.wm_elems, elem, _elem_map_entry);
      info ={... info, ... em.info, evt};

      let evt0 = evt.split(/[_.]/, 1)[0];
      if ('init' === evt0) {
        evt_fn(elem);
        return this}

      let old_fn = em.get(evt);

      elem.addEventListener(evt0, evt_fn, evt_opt);
      em.set(evt, evt_fn);

      if (undefined !== old_fn) {
        elem.removeEventListener(evt0, old_fn); }

      if ('message' === evt0 && _is_fn(elem.start)) {
        elem.start();} }

    return this

    function evt_fn(e) {
      let v = xfn(e, emit, info);
      if (undefined !== v) {
        emit({... info, v}); } } }


, remove(elem, ... keys) {
    let {wm_elems} = this;
    let evt_map = wm_elems.get(elem) || new Map();

    let ev_pairs;
    if (0 === keys.length) {
      wm_elems.delete(elem);
      ev_pairs = evt_map.entries();}

    else {
      ev_pairs = keys.map(
        evt0 => [evt0, evt_map.get(evt0)]); }

    for (let [evt0, evt_fn] of ev_pairs) {
      if (undefined !== evt_fn) {
        evt_map.delete(evt0);
        elem.removeEventListener(evt0, evt_fn);} }
    return this}


, set_info(el, info) {
    let em = _wm_item(this.wm_elems, el, _elem_map_entry);
    _obj_assign(em.info, info);
    return this}

, with(... ns_args) {
    let {listen, set_info, info} = this;
    set_info = set_info.bind(this);

    for (let ns of ns_args) {
      let ns_this = undefined === ns.info ? this :
        {__proto__: this, info:{... info, ... ns.info}};

      let events =[... _iter_event_list(ns)];
      for (let elem of _iter_named_elems(ns.$, set_info)) {
        for (let evt_args of events) {
          listen.call(ns_this, elem, ... evt_args);} } }

    return this} };


function _elem_map_entry(elem) {
  let k = elem.name || elem.id
    || (elem.type || elem.tagName || '').toLowerCase()
    || elem[Symbol.toStringTag];

  let m = new Map();
  m.info ={dom_item: k, k};
  return m}


function * _iter_named_elems(lst, set_info) {
  lst = _is_array(lst) ? lst
    : lst.addEventListener ? [lst]
    : Object.entries(lst);

  for (let ea of lst) {
    if (_is_array(ea)) {
      set_info(ea[1], {k: ea[0]});
      yield ea[1];}

    else yield ea;} }


function * _iter_event_list(ns) {
  for (let [attr, efn] of Object.entries(ns)) {
    if (! efn || /[^a-z]/.test(attr)) {
      continue}

    attr = attr.replace('_', '.');
    if ('function' === typeof efn) {
      yield [attr, efn, efn.evt_opt];}

    else if (efn.on_evt || efn.evt_opt) {
      yield [attr, efn.on_evt, efn.evt_opt];} } }

const ao_tgt = ao_pipe({
  * xgfold() {
    let ns = {};
    while (1) {
      let e = yield ns;
      ns[e.k] = e.v;} }

, xemit: ns =>({...ns}) });


ao_dom_events(ao_tgt).with({
  $:{
    a: document.querySelector('#aaa')
  , b: document.querySelector('#bbb')
  , c: document.querySelector('#ccc')}

, init: target =>({value: target.valueAsNumber})
, input: evt =>({value: evt.target.valueAsNumber}) });


const ao_tgt_rgb = ((async function *(){
  for await ({a,b,c} of ao_tgt) {
    yield `rgb(${(a.value*.255).toFixed(1)}, ${(b.value*.255).toFixed(1)}, ${(c.value*.255).toFixed(1)})`;} })());


const ao_tgt_hsl = ((async function *(){
  for await ({a,b,c} of ao_tgt) {
    yield `hsl(${(a.value*0.36).toFixed(1)}, ${(b.value/10).toFixed(1)}%, ${(c.value/10).toFixed(1)}%)`;} })());


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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX2lucHV0Lm1qcyIsInNvdXJjZXMiOlsiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vZG9tX2lucHV0LmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7XG4gIGFzc2lnbjogX29ial9hc3NpZ24sXG4gIGRlZmluZVByb3BlcnRpZXM6IF9vYmpfcHJvcHMsXG59ID0gT2JqZWN0O1xuXG5jb25zdCB7XG4gIGlzQXJyYXk6IF9pc19hcnJheSxcbn0gPSBBcnJheTtcblxuY29uc3QgaXNfYW9faXRlciA9IGcgPT5cbiAgbnVsbCAhPSBnW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTtcblxuY29uc3QgX2lzX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcbmNvbnN0IF9yZXRfaWRlbnQgPSB2ID0+IHY7XG5cbmNvbnN0IF94aW52b2tlJDEgPSB2X2ZuID0+XG4gIF9pc19mbih2X2ZuKVxuICAgID8gdl9mbigpXG4gICAgOiB2X2ZuO1xuXG5mdW5jdGlvbiBfeHBpcGVfdGd0KHBpcGUpIHtcbiAgaWYgKF9pc19mbihwaXBlKSkge1xuICAgIHBpcGUgPSBwaXBlKCk7XG4gICAgcGlwZS5uZXh0KCk7XG4gICAgcmV0dXJuIHBpcGV9XG5cbiAgcmV0dXJuIHBpcGUuZ19pbiB8fCBwaXBlfVxuXG5mdW5jdGlvbiAqIGl0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogX3hpbnZva2UkMShnZW5faW4pO31cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlJDEoZ2VuX2luKTt9XG5cblxuZnVuY3Rpb24gZm5fY2hhaW4odGFpbCwgY3R4KSB7XG4gIHJldHVybiBfb2JqX2Fzc2lnbihjaGFpbix7XG4gICAgY2hhaW4sIHRhaWw6IF94aW52b2tlJDEodGFpbCl9IClcblxuICBmdW5jdGlvbiBjaGFpbihmbikge1xuICAgIGNoYWluLnRhaWwgPSBmbihjaGFpbi50YWlsLCBjdHgpO1xuICAgIHJldHVybiBjaGFpbn0gfVxuXG5cbmZ1bmN0aW9uIF93bV9waXBlX2Nsb3N1cmUod21fYWJzZW50KSB7XG4gIGxldCB3bSA9IG5ldyBXZWFrTWFwKCk7XG4gIHJldHVybiBwaXBlID0+XG4gICAgX3dtX2l0ZW0od20sXG4gICAgICBwaXBlLmdfaW4gfHwgcGlwZSxcbiAgICAgIHdtX2Fic2VudCkgfVxuXG5mdW5jdGlvbiBfd21fY2xvc3VyZSh3bV9hYnNlbnQpIHtcbiAgbGV0IHdtID0gbmV3IFdlYWtNYXAoKTtcbiAgcmV0dXJuIGtleSA9PlxuICAgIF93bV9pdGVtKHdtLFxuICAgICAga2V5LCB3bV9hYnNlbnQpIH1cblxuZnVuY3Rpb24gX3dtX2l0ZW0od20sIHdtX2tleSwgd21fYWJzZW50KSB7XG4gIGxldCBpdGVtID0gd20uZ2V0KHdtX2tleSk7XG4gIGlmICh1bmRlZmluZWQgPT09IGl0ZW0pIHtcbiAgICBpdGVtID0gd21fYWJzZW50KHdtX2tleSk7XG4gICAgd20uc2V0KHdtX2tleSwgaXRlbSk7fVxuICByZXR1cm4gaXRlbX1cblxuY29uc3QgYW9fZGVmZXJyZWRfdiA9ICgoKCkgPT4ge1xuICBsZXQgeSxuLF9wc2V0ID0gKGEsYikgPT4geyB5PWEsIG49YjsgfTtcbiAgcmV0dXJuIHAgPT4oXG4gICAgcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuICAsIFtwLCB5LCBuXSkgfSkoKSk7XG5cbmNvbnN0IGFvX2RlZmVycmVkID0gdiA9PihcbiAgdiA9IGFvX2RlZmVycmVkX3YoKVxuLCB7cHJvbWlzZTogdlswXSwgcmVzb2x2ZTogdlsxXSwgcmVqZWN0OiB2WzJdfSk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3YoKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSAoKT0+e307XG4gIGxldCBfcHNldCA9IGEgPT4gX3Jlc3VtZSA9IGE7XG5cbiAgcmV0dXJuIFtcbiAgICAoKSA9PiAwICE9PSBwID8gcFxuICAgICAgOiBwID0gbmV3IFByb21pc2UoX3BzZXQpXG5cbiAgLCB2ID0+IHtwID0gMDsgX3Jlc3VtZSh2KTt9IF0gfVxuXG5cbmNvbnN0IF9hb19mZW5jZV9hcGkgPXtcbiAgc3RvcCgpIHt0aGlzLmZlbmNlLmRvbmUgPSB0cnVlO31cblxuLCBhb19mb3JrKCkge1xuICAgIHJldHVybiBhb19mZW5jZV9mb3JrKHRoaXMuZmVuY2UpfVxuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfSB9O1xuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBfb2JqX2Fzc2lnbih0Z3QsIF9hb19mZW5jZV9hcGkpO1xuICByZXR1cm4gZn1cblxuZnVuY3Rpb24gYW9fZmVuY2Vfb2JqKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX2ZuKHRndCk7XG4gIHJldHVybiB7X19wcm90b19fOiBfYW9fZmVuY2VfYXBpXG4gICwgZmVuY2U6IHRndCB8fCBmWzBdLCByZXNldDogZlsxXX0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fZmVuY2VfZm9yayhmZW5jZSkge1xuICB3aGlsZSAoISBmZW5jZS5kb25lKSB7XG4gICAgbGV0IHYgPSBhd2FpdCBmZW5jZSgpO1xuICAgIGlmIChmZW5jZS5kb25lKSB7XG4gICAgICByZXR1cm4gdn1cbiAgICB5aWVsZCB2O30gfVxuXG5cbi8vIGV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGFvX2ZlbmNlX21hcmtzKGZlbmNlLCBvcHQpIDo6XG4vLyAgIGxldCB7c2lnbmFsLCB0cmFpbGluZywgaW5pdGlhbH0gPSBvcHQgfHwge31cbi8vICAgbGV0IGYgPSB0cnVlID09PSBpbml0aWFsXG4vLyAgICAgPyBmZW5jZSgpIDogaW5pdGlhbFxuLy9cbi8vICAgd2hpbGUgISBmZW5jZS5kb25lIDo6XG4vLyAgICAgbGV0IHZcbi8vICAgICBpZiB0cmFpbGluZyA6OlxuLy8gICAgICAgdiA9IGF3YWl0IGZcbi8vICAgICAgIGYgPSBmZW5jZSgpXG4vL1xuLy8gICAgIGVsc2UgOjpcbi8vICAgICAgIGYgPSBmZW5jZSgpXG4vLyAgICAgICB2ID0gYXdhaXQgZlxuLy9cbi8vICAgICBpZiBmZW5jZS5kb25lIDo6XG4vLyAgICAgICByZXR1cm4gdlxuLy9cbi8vICAgICBpZiBfaXNfZm4oc2lnbmFsKSA6OlxuLy8gICAgICAgeWllbGQgc2lnbmFsKHYpXG4vLyAgICAgZWxzZSBpZiBzaWduYWwgOjpcbi8vICAgICAgIHlpZWxkIHNpZ25hbFxuLy8gICAgIGVsc2UgeWllbGQgdlxuXG5hc3luYyBmdW5jdGlvbiBhb19ydW4oZ2VuX2luLCBub3RpZnk9X3JldF9pZGVudCkge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoZ2VuX2luKSkge1xuICAgIG5vdGlmeSh2KTt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIHhmb3JtPV9yZXRfaWRlbnQpIHtcbiAgZ2VuX3RndCA9IF94cGlwZV90Z3QoZ2VuX3RndCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UkMShnZW5faW4pKSB7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gZ2VuX3RndCkge1xuICAgICAgdiA9IHhmb3JtKHYpO1xuICAgICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICAgIGlmIChkb25lKSB7YnJlYWt9IH0gfSB9XG5cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG11bHRpcGxlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG11bHRpcGxlKSB9IH0gfVxuXG5mdW5jdGlvbiBhb19mb3JrKCkge1xuICByZXR1cm4gYW9fZmVuY2VfZm9yayh0aGlzLmZlbmNlKX1cblxuY29uc3QgX2FvX3RhcF9wcm9wcyA9e1xuICBhb19mb3JrOnt2YWx1ZTogYW9fZm9ya31cbiwgY2hhaW46e2dldCgpIHtcbiAgICByZXR1cm4gZm5fY2hhaW4odGhpcywgdGhpcyl9IH0gfTtcblxuZnVuY3Rpb24gYW9fdGFwKGFnX291dCkge1xuICByZXR1cm4gX29ial9wcm9wcyhfYW9fdGFwKGFnX291dCksIF9hb190YXBfcHJvcHMpIH1cblxuZnVuY3Rpb24gX2FvX3RhcChhZ19vdXQpIHtcbiAgbGV0IFtmZW5jZSwgcmVzZXRdID0gYW9fZmVuY2VfdigpO1xuICBsZXQgZ2VuID0gKChhc3luYyBmdW5jdGlvbiAqICgpIHtcbiAgICBmZW5jZS5kb25lID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UkMShhZ19vdXQpKSB7XG4gICAgICAgIHJlc2V0KHYpO1xuICAgICAgICB5aWVsZCB2O30gfVxuICAgIGZpbmFsbHkge1xuICAgICAgZmVuY2UuZG9uZSA9IHRydWU7XG4gICAgICByZXNldCgpO30gfSkuY2FsbCh0aGlzKSk7XG5cbiAgZ2VuLmZlbmNlID0gZmVuY2U7XG4gIHJldHVybiBnZW59XG5cblxuXG5jb25zdCBfYW9fc3BsaXRfYXBpID17XG4gIGdldCBjaGFpbigpIHtcbiAgICByZXR1cm4gZm5fY2hhaW4odGhpcywgdGhpcyl9XG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl06IGFvX2ZvcmtcbiwgYW9fZm9ya307XG5cbmZ1bmN0aW9uIGFvX3NwbGl0KGFnX291dCkge1xuICBsZXQgZ2VuID0gX2FvX3RhcChhZ19vdXQpO1xuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2FvX3NwbGl0X2FwaVxuICAsIGZpbjogYW9fcnVuKGdlbilcbiAgLCBmZW5jZTogZ2VuLmZlbmNlfSB9XG5cbmNvbnN0IF9hc19waXBlX2VuZCA9IChnLG5zKSA9PiBfb2JqX2Fzc2lnbihnLCBucyk7XG5cbi8vfn5+XG4vLyBQaXBlIGJhc2UgYXMgZ2VuZXJhdG9yIGluIGNvbXBvc2VkIG9iamVjdC1mdW5jdGlvbmFsIGltcGxlbWVudGF0aW9uXG5cbmNvbnN0IF9hb19waXBlX2Jhc2UgPXtcbiAgeGZvbGQ6IHYgPT4gdiAvLyBvbiBwdXNoOiBpZGVudGl0eSB0cmFuc2Zvcm1cbiwgeHB1bGwoKSB7fSAvLyBtZW1vcnk6IG5vbmVcbiwgeGVtaXQ6IF94aW52b2tlJDEgLy8gaWRlbnRpdHkgdHJhbnNmb3JtIG9yIGludm9rZSBpZiBmdW5jdGlvblxuLCB4aW5pdChnX2luLCBhZ19vdXQpIHt9IC8vIG9uIGluaXQ6IGRlZmF1bHQgYmVoYXZpb3JcblxuLCBnZXQgY3JlYXRlKCkge1xuICAgIC8vIGFzIGdldHRlciB0byBiaW5kIGNsYXNzIGFzIGB0aGlzYCBhdCBhY2Nlc3MgdGltZVxuICAgIGNvbnN0IGNyZWF0ZSA9ICguLi4gYXJncykgPT5cbiAgICAgIF9vYmpfYXNzaWduKHtfX3Byb3RvX186IHRoaXN9LFxuICAgICAgICAuLi4gYXJncy5tYXAoX3hpbnZva2UkMSkpXG4gICAgICAuX2FvX3BpcGUoKTtcblxuICAgIHJldHVybiBjcmVhdGUuY3JlYXRlID0gY3JlYXRlfVxuXG4sIF9hb19waXBlKCkge1xuICAgIGxldCBmaW5fbHN0ID0gW107XG4gICAgbGV0IHNlbGYgPXtcbiAgICAgIG9uX2ZpbjogZyA9PihcbiAgICAgICAgZmluX2xzdC5wdXNoKGcpXG4gICAgICAsIGcpXG5cbiAgICAsIHN0b3A6ICgoKSA9PiB7XG4gICAgICAgIHRoaXMuZG9uZSA9IHRydWU7XG4gICAgICAgIF9maW5fcGlwZShmaW5fbHN0KTtcbiAgICAgICAgdGhpcy5fcmVzdW1lKCk7fSkgfTtcblxuICAgIGxldCB7a2luZH0gPSB0aGlzO1xuICAgIGxldCBnX2luID0gc2VsZi5vbl9maW4odGhpcy5fYW9fcGlwZV9pbihzZWxmLnN0b3ApKTtcbiAgICBsZXQgYWdfb3V0ID0gc2VsZi5vbl9maW4odGhpcy5fYW9fcGlwZV9vdXQoc2VsZi5zdG9wKSk7XG5cbiAgICBzZWxmLmdfaW4gPSBnX2luID0gdGhpcy5fYXNfcGlwZV9pbihnX2luLCBzZWxmLCBraW5kKTtcbiAgICBhZ19vdXQgPSB0aGlzLl9hc19waXBlX291dChhZ19vdXQsIHNlbGYsIGtpbmQpO1xuXG4gICAgdGhpcy54aW5pdChnX2luLCBhZ19vdXQpO1xuXG4gICAgLy8gYWxsb3cgZ19pbiB0byBpbml0aWFsaXplXG4gICAgZ19pbi5uZXh0KCk7XG4gICAgcmV0dXJuIGFnX291dH1cblxuLCBfYXNfcGlwZV9pbjogX2FzX3BpcGVfZW5kXG4sIF9hc19waXBlX291dDogX2FzX3BpcGVfZW5kXG5cbiwgLy9+fn5cbiAgLy8gVXBzdHJlYW0gaW5wdXQgZ2VuZXJhdG9yXG4gIC8vICAgZGVzaWduZWQgZm9yIG11bHRpcGxlIGZlZWRlcnNcblxuICAqX2FvX3BpcGVfaW4oX2ZpbmlzaCkge1xuICAgIHRyeSB7XG4gICAgICBsZXQgdjtcbiAgICAgIHdoaWxlICghIHRoaXMuZG9uZSkge1xuICAgICAgICB2ID0gdGhpcy54Zm9sZCh5aWVsZCB2KTtcbiAgICAgICAgdGhpcy52YWx1ZSA9IHY7XG4gICAgICAgIGlmICgwICE9PSB0aGlzLl93YWl0aW5nICYmIHVuZGVmaW5lZCAhPT0gdikge1xuICAgICAgICAgIHRoaXMuX3Jlc3VtZSgpO30gfSB9XG5cbiAgICBmaW5hbGx5IHtcbiAgICAgIF9maW5pc2goKTt9IH1cblxuXG4sIC8vfn5+XG4gIC8vIERvd25zdHJlYW0gYXN5bmMgb3V0cHV0IGdlbmVyYXRvclxuICAvLyAgIGRlc2lnbmVkIGZvciBzaW5nbGUgY29uc3VtZXIuXG5cbiAgYXN5bmMgKl9hb19waXBlX291dChfZmluaXNoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCByO1xuICAgICAgd2hpbGUgKCEgdGhpcy5kb25lKSB7XG4gICAgICAgIGlmICgwICE9PSAociA9IHRoaXMuX3dhaXRpbmcpKSB7XG4gICAgICAgICAgLy8gcDA6IGV4aXN0aW5nIHdhaXRlcnNcbiAgICAgICAgICByID0gYXdhaXQgcjtcbiAgICAgICAgICBpZiAodGhpcy5kb25lKSB7YnJlYWt9IH1cbiAgICAgICAgZWxzZSBpZiAodW5kZWZpbmVkICE9PSAociA9IHRoaXMudmFsdWUpKSB7XG4gICAgICAgICAgLy8gcDE6IGF2YWlsYWJsZSB2YWx1ZVxuICAgICAgICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7fVxuICAgICAgICBlbHNlIGlmICh1bmRlZmluZWQgIT09IChyID0gdGhpcy54cHVsbCgpKSkge1xuICAgICAgICAgIH0vLyBwMjogeHB1bGwgdmFsdWUgKGUuZy4gcXVldWUgbWVtb3J5KSBcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgLy8gcDM6IGFkZCBuZXcgd2FpdGVyXG4gICAgICAgICAgciA9IGF3YWl0IHRoaXMuX2JpbmRfd2FpdGluZygpO1xuICAgICAgICAgIGlmICh0aGlzLmRvbmUpIHticmVha30gfVxuXG4gICAgICAgIHlpZWxkIHRoaXMueGVtaXQocik7fSB9XG5cbiAgICBmaW5hbGx5IHtcbiAgICAgIF9maW5pc2goKTt9IH1cblxuXG4sIC8vfn5+XG4gIC8vIGdlbmVyYXRvci1saWtlIHZhbHVlL2RvbmUgc3RhdGVzXG5cbiAgdmFsdWU6IHVuZGVmaW5lZFxuLCBkb25lOiBmYWxzZVxuXG4sIC8vfn5+XG4gIC8vIHByb21pc2UtYmFzZWQgZmVuY2UgdGFpbG9yZWQgZm9yIGFvX3BpcGUgdXNlY2FzZVxuXG4gIF93YWl0aW5nOiAwXG4sIF9mdWxmaWxsKCkge31cbiwgYXN5bmMgX3Jlc3VtZSgpIHtcbiAgICBpZiAoISB0aGlzLmRvbmUpIHthd2FpdCB0aGlzO31cblxuICAgIGxldCB7dmFsdWUsIF9mdWxmaWxsfSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCAhPSB2YWx1ZSB8fCB0aGlzLmRvbmUpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLl93YWl0aW5nID0gMDtcbiAgICAgIF9mdWxmaWxsKHZhbHVlKTt9IH1cblxuLCBfYmluZF93YWl0aW5nKCkge1xuICAgIGxldCBfcmVzZXQgPSB5ID0+IHRoaXMuX2Z1bGZpbGwgPSB5O1xuICAgIHRoaXMuX2JpbmRfd2FpdGluZyA9ICgpID0+IHRoaXMuX3dhaXRpbmcgfHwoXG4gICAgICB0aGlzLl93YWl0aW5nID0gbmV3IFByb21pc2UoX3Jlc2V0KSk7XG4gICAgcmV0dXJuIHRoaXMuX2JpbmRfd2FpdGluZygpfSB9O1xuXG5cbmZ1bmN0aW9uIF9maW5fcGlwZShmaW5fbHN0KSB7XG4gIHdoaWxlICgwICE9PSBmaW5fbHN0Lmxlbmd0aCkge1xuICAgIGxldCBnID0gZmluX2xzdC5wb3AoKTtcbiAgICB0cnkge1xuICAgICAgaWYgKF9pc19mbihnKSkge2coKTt9XG4gICAgICBlbHNlIGcucmV0dXJuKCk7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHtcbiAgICAgICAgaWYgKCdHZW5lcmF0b3IgaXMgYWxyZWFkeSBydW5uaW5nJyA9PT0gZXJyLm1lc3NhZ2UpIHtcbiAgICAgICAgICBjb250aW51ZX0gfVxuICAgICAgY29uc29sZS5lcnJvcihlcnIpO30gfSB9XG5cbmNvbnN0IF9hb19waXBlX2luX2FwaSA9e1xuICBhc19waXBlX2luKHNlbGYsIGdfaW4pIHt9XG5cbiwgd2l0aF9jdHgoeGN0eCkge1xuICAgIGlmIChfaXNfZm4oeGN0eCkpIHtcbiAgICAgIHhjdHggPSB4Y3R4KHRoaXMpO31cblxuICAgIGlmICh4Y3R4ICYmIHhjdHgubmV4dCkge1xuICAgICAgeGN0eC5uZXh0KHRoaXMpO1xuICAgICAgdGhpcy5vbl9maW4oeGN0eCk7fVxuICAgIHJldHVybiB4Y3R4fVxuXG4sIGZlZWQoeHNyYywgeGZvcm0pIHtcbiAgICByZXR1cm4gYW9fZHJpdmUoeHNyYywgdGhpcywgeGZvcm0pfVxuXG4sIGJpbmRfdmVjKC4uLiBrZXlzKSB7XG4gICAgcmV0dXJuIHYgPT4gdGhpcy5uZXh0KFsuLi5rZXlzLCB2XSkgfVxuXG4sIGJpbmRfb2JqKGtleSwgbnMpIHtcbiAgICByZXR1cm4gdiA9PiB0aGlzLm5leHQoey4uLm5zLCBba2V5XTogdn0pIH0gfTtcblxuZnVuY3Rpb24gX2FvX3BpcGVfaW4oZ19pbiwgc2VsZikge1xuICByZXR1cm4gX29ial9hc3NpZ24oZ19pbiwgX2FvX3BpcGVfaW5fYXBpLCBzZWxmKX1cblxuY29uc3QgX2FvX3BpcGVfb3V0X2tpbmRzID17XG4gIGFvX3JhdzogZyA9PiBnXG4sIGFvX3NwbGl0OiBhb19zcGxpdFxuLCBhb190YXA6IGFvX3RhcH07XG5cbmZ1bmN0aW9uIF9hb19waXBlX291dChhZ19vdXQsIHNlbGYsIGtpbmQpIHtcbiAga2luZCA9IC9eYW9fLy50ZXN0KGtpbmQpID8ga2luZCA6ICdhb18nK2tpbmQ7XG4gIGxldCBhb193cmFwID0gX2FvX3BpcGVfb3V0X2tpbmRzW2tpbmRdO1xuICBpZiAodW5kZWZpbmVkID09PSBhb193cmFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub253biBhb19waXBlX291dCBraW5kIFwiJHtraW5kfVwiYCl9XG5cbiAgcmV0dXJuIF9vYmpfYXNzaWduKGFvX3dyYXAoYWdfb3V0KSwgc2VsZikgfVxuXG5jb25zdCBfYW9fcGlwZSA9e1xuICBfX3Byb3RvX186IF9hb19waXBlX2Jhc2VcblxuLCAvLyB4Zm9sZDogdiA9PiB2IC0tIG9uIHB1c2g6IGlkZW50aXR5IHRyYW5zZm9ybVxuICAvLyB4cHVsbCgpIHt9IC0tIG1lbW9yeTogbm9uZVxuICAvLyB4ZW1pdDogX3hpbnZva2UgLS0gaWRlbnRpdHkgdHJhbnNmb3JtIG9yIGludm9rZSBpZiBmdW5jdGlvblxuXG4gIC8vICp4Z2ZvbGQoKSAtLSBvbiBwdXNoOiBnZW5lcmF0b3ItYmFzZWQgZm9sZCBpbXBsXG4gIC8vICp4c3JjKCkgLS0gZmVlZCB3aXRoIHNvdXJjZSBnZW5lcmF0b3JcbiAgLy8gKnhjdHgoZ2VuX3NyYykgLS0gb24gaW5pdDogYmluZCBldmVudCBzb3VyY2VzXG5cbiAga2luZDogJ3NwbGl0J1xuLCBfYXNfcGlwZV9pbjogX2FvX3BpcGVfaW5cbiwgX2FzX3BpcGVfb3V0OiBfYW9fcGlwZV9vdXRcblxuLCB4aW5pdChnX2luKSB7XG4gICAgbGV0IHhnZm9sZCA9IHRoaXMueGdmb2xkO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhnZm9sZCkge1xuICAgICAgdGhpcy5faW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKTt9XG5cbiAgICB0aGlzLl9pbml0X2NoYWluKGdfaW4pO31cblxuXG4sIF9pbml0X3hnZm9sZChnX2luLCB4Z2ZvbGQpIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSB4Z2ZvbGQpIHtcbiAgICAgIHJldHVybn1cblxuICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgeGdmb2xkID0geGdmb2xkLmNhbGwodGhpcywgdGhpcyk7XG5cbiAgICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgICB0aGlzLnhmb2xkID0geGdmb2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZX1cblxuICAgICAgeGdmb2xkLm5leHQoKTt9XG5cbiAgICB0aGlzLnhnZm9sZCA9IHhnZm9sZDtcbiAgICB0aGlzLnhmb2xkID0gdGhpcy5fZm9sZF9nZW47XG4gICAgZ19pbi5vbl9maW4oeGdmb2xkKTtcbiAgICByZXR1cm4gdHJ1ZX1cblxuLCBfZm9sZF9nZW4odikge1xuICAgIGxldCB7ZG9uZSwgdmFsdWV9ID0gdGhpcy54Z2ZvbGQubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge3RoaXMuZG9uZSA9IHRydWU7fVxuICAgIHJldHVybiB2YWx1ZX1cblxuXG4sIF9pbml0X2NoYWluKGdfaW4pIHtcbiAgICBsZXQge3hzcmMsIHhjdHh9ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4c3JjKSB7XG4gICAgICBnX2luLmZlZWQoeHNyYylcbiAgICAgICAgLnRoZW4gKCgpID0+Z19pbi5yZXR1cm4oKSk7IH1cblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhjdHgpIHtcbiAgICAgIGdfaW4ud2l0aF9jdHgoeGN0eCk7fSB9IH07XG5cblxuY29uc3QgYW9fcGlwZSA9IF9hb19waXBlLmNyZWF0ZTtcblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzZXQsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7fSk7XG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZShnZW5faW4pKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgdik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoZ2VuX2luKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbihyYWYpO1xuICByYWYuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2FuY2VsQW5pbWF0aW9uRnJhbWUodGlkKTtcbiAgICByYWYuZG9uZSA9IHRydWU7fSk7XG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXNldCk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IGFvX2RvbV9ldmVudHMgPVxuICBfd21fcGlwZV9jbG9zdXJlKF9hb19kb21fZXZlbnRzX2N0eCk7XG5cbmZ1bmN0aW9uIF9hb19kb21fZXZlbnRzX2N0eChnX2luKSB7XG4gIHJldHVybiB7X19wcm90b19fOiBfZG9tX2V2ZW50c19hcGlcbiAgLCB3bV9lbGVtczogbmV3IFdlYWtNYXAoKVxuICAsIGVtaXQ6IGluZm8gPT4gZ19pbi5uZXh0KGluZm8pfSB9XG5cblxuY29uc3QgX2RvbV9ldmVudHNfYXBpID17XG4gIC8vIHdtX2VsZW1zOiBuZXcgV2Vha01hcCgpXG4gIC8vIGVtaXQ6IGluZm8gPT4gZ19pbi5uZXh0KGluZm8pXG5cbiAgbGlzdGVuKGVsZW0sIGV2dCwgeGZuLCBldnRfb3B0KSB7XG4gICAgbGV0IHtlbWl0LCBpbmZvfSA9IHRoaXM7XG4gICAgIHtcbiAgICAgIGxldCBlbSA9IF93bV9pdGVtKHRoaXMud21fZWxlbXMsIGVsZW0sIF9lbGVtX21hcF9lbnRyeSk7XG4gICAgICBpbmZvID17Li4uIGluZm8sIC4uLiBlbS5pbmZvLCBldnR9O1xuXG4gICAgICBsZXQgZXZ0MCA9IGV2dC5zcGxpdCgvW18uXS8sIDEpWzBdO1xuICAgICAgaWYgKCdpbml0JyA9PT0gZXZ0MCkge1xuICAgICAgICBldnRfZm4oZWxlbSk7XG4gICAgICAgIHJldHVybiB0aGlzfVxuXG4gICAgICBsZXQgb2xkX2ZuID0gZW0uZ2V0KGV2dCk7XG5cbiAgICAgIGVsZW0uYWRkRXZlbnRMaXN0ZW5lcihldnQwLCBldnRfZm4sIGV2dF9vcHQpO1xuICAgICAgZW0uc2V0KGV2dCwgZXZ0X2ZuKTtcblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gb2xkX2ZuKSB7XG4gICAgICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldnQwLCBvbGRfZm4pOyB9XG5cbiAgICAgIGlmICgnbWVzc2FnZScgPT09IGV2dDAgJiYgX2lzX2ZuKGVsZW0uc3RhcnQpKSB7XG4gICAgICAgIGVsZW0uc3RhcnQoKTt9IH1cblxuICAgIHJldHVybiB0aGlzXG5cbiAgICBmdW5jdGlvbiBldnRfZm4oZSkge1xuICAgICAgbGV0IHYgPSB4Zm4oZSwgZW1pdCwgaW5mbyk7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSB2KSB7XG4gICAgICAgIGVtaXQoey4uLiBpbmZvLCB2fSk7IH0gfSB9XG5cblxuLCByZW1vdmUoZWxlbSwgLi4uIGtleXMpIHtcbiAgICBsZXQge3dtX2VsZW1zfSA9IHRoaXM7XG4gICAgbGV0IGV2dF9tYXAgPSB3bV9lbGVtcy5nZXQoZWxlbSkgfHwgbmV3IE1hcCgpO1xuXG4gICAgbGV0IGV2X3BhaXJzO1xuICAgIGlmICgwID09PSBrZXlzLmxlbmd0aCkge1xuICAgICAgd21fZWxlbXMuZGVsZXRlKGVsZW0pO1xuICAgICAgZXZfcGFpcnMgPSBldnRfbWFwLmVudHJpZXMoKTt9XG5cbiAgICBlbHNlIHtcbiAgICAgIGV2X3BhaXJzID0ga2V5cy5tYXAoXG4gICAgICAgIGV2dDAgPT4gW2V2dDAsIGV2dF9tYXAuZ2V0KGV2dDApXSk7IH1cblxuICAgIGZvciAobGV0IFtldnQwLCBldnRfZm5dIG9mIGV2X3BhaXJzKSB7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBldnRfZm4pIHtcbiAgICAgICAgZXZ0X21hcC5kZWxldGUoZXZ0MCk7XG4gICAgICAgIGVsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldnQwLCBldnRfZm4pO30gfVxuICAgIHJldHVybiB0aGlzfVxuXG5cbiwgc2V0X2luZm8oZWwsIGluZm8pIHtcbiAgICBsZXQgZW0gPSBfd21faXRlbSh0aGlzLndtX2VsZW1zLCBlbCwgX2VsZW1fbWFwX2VudHJ5KTtcbiAgICBfb2JqX2Fzc2lnbihlbS5pbmZvLCBpbmZvKTtcbiAgICByZXR1cm4gdGhpc31cblxuLCB3aXRoKC4uLiBuc19hcmdzKSB7XG4gICAgbGV0IHtsaXN0ZW4sIHNldF9pbmZvLCBpbmZvfSA9IHRoaXM7XG4gICAgc2V0X2luZm8gPSBzZXRfaW5mby5iaW5kKHRoaXMpO1xuXG4gICAgZm9yIChsZXQgbnMgb2YgbnNfYXJncykge1xuICAgICAgbGV0IG5zX3RoaXMgPSB1bmRlZmluZWQgPT09IG5zLmluZm8gPyB0aGlzIDpcbiAgICAgICAge19fcHJvdG9fXzogdGhpcywgaW5mbzp7Li4uIGluZm8sIC4uLiBucy5pbmZvfX07XG5cbiAgICAgIGxldCBldmVudHMgPVsuLi4gX2l0ZXJfZXZlbnRfbGlzdChucyldO1xuICAgICAgZm9yIChsZXQgZWxlbSBvZiBfaXRlcl9uYW1lZF9lbGVtcyhucy4kLCBzZXRfaW5mbykpIHtcbiAgICAgICAgZm9yIChsZXQgZXZ0X2FyZ3Mgb2YgZXZlbnRzKSB7XG4gICAgICAgICAgbGlzdGVuLmNhbGwobnNfdGhpcywgZWxlbSwgLi4uIGV2dF9hcmdzKTt9IH0gfVxuXG4gICAgcmV0dXJuIHRoaXN9IH07XG5cblxuZnVuY3Rpb24gX2VsZW1fbWFwX2VudHJ5KGVsZW0pIHtcbiAgbGV0IGsgPSBlbGVtLm5hbWUgfHwgZWxlbS5pZFxuICAgIHx8IChlbGVtLnR5cGUgfHwgZWxlbS50YWdOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgfHwgZWxlbVtTeW1ib2wudG9TdHJpbmdUYWddO1xuXG4gIGxldCBtID0gbmV3IE1hcCgpO1xuICBtLmluZm8gPXtkb21faXRlbTogaywga307XG4gIHJldHVybiBtfVxuXG5cbmZ1bmN0aW9uICogX2l0ZXJfbmFtZWRfZWxlbXMobHN0LCBzZXRfaW5mbykge1xuICBsc3QgPSBfaXNfYXJyYXkobHN0KSA/IGxzdFxuICAgIDogbHN0LmFkZEV2ZW50TGlzdGVuZXIgPyBbbHN0XVxuICAgIDogT2JqZWN0LmVudHJpZXMobHN0KTtcblxuICBmb3IgKGxldCBlYSBvZiBsc3QpIHtcbiAgICBpZiAoX2lzX2FycmF5KGVhKSkge1xuICAgICAgc2V0X2luZm8oZWFbMV0sIHtrOiBlYVswXX0pO1xuICAgICAgeWllbGQgZWFbMV07fVxuXG4gICAgZWxzZSB5aWVsZCBlYTt9IH1cblxuXG5mdW5jdGlvbiAqIF9pdGVyX2V2ZW50X2xpc3QobnMpIHtcbiAgZm9yIChsZXQgW2F0dHIsIGVmbl0gb2YgT2JqZWN0LmVudHJpZXMobnMpKSB7XG4gICAgaWYgKCEgZWZuIHx8IC9bXmEtel0vLnRlc3QoYXR0cikpIHtcbiAgICAgIGNvbnRpbnVlfVxuXG4gICAgYXR0ciA9IGF0dHIucmVwbGFjZSgnXycsICcuJyk7XG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBlZm4pIHtcbiAgICAgIHlpZWxkIFthdHRyLCBlZm4sIGVmbi5ldnRfb3B0XTt9XG5cbiAgICBlbHNlIGlmIChlZm4ub25fZXZ0IHx8IGVmbi5ldnRfb3B0KSB7XG4gICAgICB5aWVsZCBbYXR0ciwgZWZuLm9uX2V2dCwgZWZuLmV2dF9vcHRdO30gfSB9XG5cbmV4cG9ydCB7IF9hb19kb21fZXZlbnRzX2N0eCwgX2FvX3BpcGUsIF9hb19waXBlX2Jhc2UsIF9hb19waXBlX2luLCBfYW9fcGlwZV9pbl9hcGksIF9hb19waXBlX291dCwgX2FvX3BpcGVfb3V0X2tpbmRzLCBfYW9fdGFwLCBfZG9tX2V2ZW50c19hcGksIF93bV9jbG9zdXJlLCBfd21faXRlbSwgX3dtX3BpcGVfY2xvc3VyZSwgX3hpbnZva2UkMSBhcyBfeGludm9rZSwgX3hwaXBlX3RndCwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fZXZlbnRzLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2ZvcmssIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfdiwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX3BpcGUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgZm5fY2hhaW4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2FvX3BpcGUsIGFvX2RvbV9ldmVudHN9IGZyb20gJ3JvYXAnXG5cbmNvbnN0IGFvX3RndCA9IGFvX3BpcGUgQDpcbiAgKiB4Z2ZvbGQoKSA6OlxuICAgIGxldCBucyA9IHt9XG4gICAgd2hpbGUgMSA6OlxuICAgICAgbGV0IGUgPSB5aWVsZCBuc1xuICAgICAgbnNbZS5rXSA9IGUudlxuXG4gIHhlbWl0OiBucyA9PiBAOiAuLi5uc1xuXG5cbmFvX2RvbV9ldmVudHMoYW9fdGd0KS53aXRoIEA6XG4gICQ6IEB7fVxuICAgIGE6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNhYWEnKVxuICAgIGI6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNiYmInKVxuICAgIGM6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjY2MnKVxuXG4gIGluaXQ6IHRhcmdldCA9PiBAOiB2YWx1ZTogdGFyZ2V0LnZhbHVlQXNOdW1iZXJcbiAgaW5wdXQ6IGV2dCA9PiBAOiB2YWx1ZTogZXZ0LnRhcmdldC52YWx1ZUFzTnVtYmVyXG5cblxuY29uc3QgYW9fdGd0X3JnYiA9IEAqPlxuICBmb3IgYXdhaXQge2EsYixjfSBvZiBhb190Z3QgOjpcbiAgICB5aWVsZCBgcmdiKCR7KGEudmFsdWUqLjI1NSkudG9GaXhlZCgxKX0sICR7KGIudmFsdWUqLjI1NSkudG9GaXhlZCgxKX0sICR7KGMudmFsdWUqLjI1NSkudG9GaXhlZCgxKX0pYFxuICAgICAgXG5cbmNvbnN0IGFvX3RndF9oc2wgPSBAKj5cbiAgZm9yIGF3YWl0IHthLGIsY30gb2YgYW9fdGd0IDo6XG4gICAgeWllbGQgYGhzbCgkeyhhLnZhbHVlKjAuMzYpLnRvRml4ZWQoMSl9LCAkeyhiLnZhbHVlLzEwKS50b0ZpeGVkKDEpfSUsICR7KGMudmFsdWUvMTApLnRvRml4ZWQoMSl9JSlgXG5cblxuOjohPlxuICBsZXQgZWxfcmdiID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RndF9yZ2InKVxuICBmb3IgYXdhaXQgbGV0IHJnYiBvZiBhb190Z3RfcmdiIDo6XG4gICAgZWxfcmdiLnRleHRDb250ZW50ID0gcmdiXG4gICAgZWxfcmdiLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHJnYlxuXG46OiE+XG4gIGxldCBlbF9oc2wgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGd0X2hzbCcpXG4gIGZvciBhd2FpdCBsZXQgaHNsIG9mIGFvX3RndF9oc2wgOjpcbiAgICBlbF9oc2wudGV4dENvbnRlbnQgPSBoc2xcbiAgICBlbF9oc2wuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gaHNsXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTTtBQUNOLEVBQUUsTUFBTSxFQUFFLFdBQVc7QUFDckIsRUFBRSxnQkFBZ0IsRUFB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
