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

function ao_interval(ms=1000) {
  let [_fence, _reset] = ao_fence_fn();
  let tid = setInterval(_reset, ms, 1);
  if (tid.unref) {tid.unref();}
  _fence.stop = (() => {
    tid = clearInterval(tid);
    _fence.done = true;});
  return _fence}


async function * ao_times(gen_in) {
  let ts0 = Date.now();
  for await (let v of gen_in) {
    yield Date.now() - ts0;} }

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

const ao_tgt = ao_pipe();

ao_dom_events(ao_tgt).with({
  $: window
, storage(evt) {
    let {key, oldValue, newValue, url} = evt;
    return {key, oldValue, newValue, url} } });


{(async ()=>{
  let el_output = document.querySelector('output');
  for await (let e of ao_tgt) {
    console.log('ao_tgt:', e);

    let el_pre = document.createElement('pre');
    el_pre.textContent = JSON.stringify(e, null, 2);
    el_output.appendChild(el_pre);} })();}


{(async ()=>{
  let tab_id = Math.random().toString(36).slice(2);
  for await (let ts of ao_times(ao_interval(1000)) ) {
    localStorage.setItem(tab_id,[tab_id, ts]); } })();}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tX3N0b3JhZ2UubWpzIiwic291cmNlcyI6WyIuLi8uLi9lc20vcm9hcC5tanMiLCIuLi9kb21fc3RvcmFnZS5qc3kiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3Qge1xuICBhc3NpZ246IF9vYmpfYXNzaWduLFxuICBkZWZpbmVQcm9wZXJ0aWVzOiBfb2JqX3Byb3BzLFxufSA9IE9iamVjdDtcblxuY29uc3Qge1xuICBpc0FycmF5OiBfaXNfYXJyYXksXG59ID0gQXJyYXk7XG5cbmNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IF9pc19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5jb25zdCBfcmV0X2lkZW50ID0gdiA9PiB2O1xuXG5jb25zdCBfeGludm9rZSQxID0gdl9mbiA9PlxuICBfaXNfZm4odl9mbilcbiAgICA/IHZfZm4oKVxuICAgIDogdl9mbjtcblxuZnVuY3Rpb24gX3hwaXBlX3RndChwaXBlKSB7XG4gIGlmIChfaXNfZm4ocGlwZSkpIHtcbiAgICBwaXBlID0gcGlwZSgpO1xuICAgIHBpcGUubmV4dCgpO1xuICAgIHJldHVybiBwaXBlfVxuXG4gIHJldHVybiBwaXBlLmdfaW4gfHwgcGlwZX1cblxuZnVuY3Rpb24gKiBpdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlJDEoZ2VuX2luKTt9XG5cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBfeGludm9rZSQxKGdlbl9pbik7fVxuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwsIGN0eCkge1xuICByZXR1cm4gX29ial9hc3NpZ24oY2hhaW4se1xuICAgIGNoYWluLCB0YWlsOiBfeGludm9rZSQxKHRhaWwpfSApXG5cbiAgZnVuY3Rpb24gY2hhaW4oZm4pIHtcbiAgICBjaGFpbi50YWlsID0gZm4oY2hhaW4udGFpbCwgY3R4KTtcbiAgICByZXR1cm4gY2hhaW59IH1cblxuXG5mdW5jdGlvbiBfd21fcGlwZV9jbG9zdXJlKHdtX2Fic2VudCkge1xuICBsZXQgd20gPSBuZXcgV2Vha01hcCgpO1xuICByZXR1cm4gcGlwZSA9PlxuICAgIF93bV9pdGVtKHdtLFxuICAgICAgcGlwZS5nX2luIHx8IHBpcGUsXG4gICAgICB3bV9hYnNlbnQpIH1cblxuZnVuY3Rpb24gX3dtX2Nsb3N1cmUod21fYWJzZW50KSB7XG4gIGxldCB3bSA9IG5ldyBXZWFrTWFwKCk7XG4gIHJldHVybiBrZXkgPT5cbiAgICBfd21faXRlbSh3bSxcbiAgICAgIGtleSwgd21fYWJzZW50KSB9XG5cbmZ1bmN0aW9uIF93bV9pdGVtKHdtLCB3bV9rZXksIHdtX2Fic2VudCkge1xuICBsZXQgaXRlbSA9IHdtLmdldCh3bV9rZXkpO1xuICBpZiAodW5kZWZpbmVkID09PSBpdGVtKSB7XG4gICAgaXRlbSA9IHdtX2Fic2VudCh3bV9rZXkpO1xuICAgIHdtLnNldCh3bV9rZXksIGl0ZW0pO31cbiAgcmV0dXJuIGl0ZW19XG5cbmNvbnN0IGFvX2RlZmVycmVkX3YgPSAoKCgpID0+IHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBbcCwgeSwgbl0pIH0pKCkpO1xuXG5jb25zdCBhb19kZWZlcnJlZCA9IHYgPT4oXG4gIHYgPSBhb19kZWZlcnJlZF92KClcbiwge3Byb21pc2U6IHZbMF0sIHJlc29sdmU6IHZbMV0sIHJlamVjdDogdlsyXX0pO1xuXG5mdW5jdGlvbiBhb19mZW5jZV92KCkge1xuICBsZXQgcD0wLCBfcmVzdW1lID0gKCk9Pnt9O1xuICBsZXQgX3BzZXQgPSBhID0+IF9yZXN1bWUgPSBhO1xuXG4gIHJldHVybiBbXG4gICAgKCkgPT4gMCAhPT0gcCA/IHBcbiAgICAgIDogcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuXG4gICwgdiA9PiB7cCA9IDA7IF9yZXN1bWUodik7fSBdIH1cblxuXG5jb25zdCBfYW9fZmVuY2VfYXBpID17XG4gIHN0b3AoKSB7dGhpcy5mZW5jZS5kb25lID0gdHJ1ZTt9XG5cbiwgYW9fZm9yaygpIHtcbiAgICByZXR1cm4gYW9fZmVuY2VfZm9yayh0aGlzLmZlbmNlKX1cblxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmFvX2ZvcmsoKX0gfTtcblxuZnVuY3Rpb24gYW9fZmVuY2VfZm4odGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfdigpO1xuICBpZiAodW5kZWZpbmVkID09PSB0Z3QpIHt0Z3QgPSBmWzBdO31cbiAgdGd0LmZlbmNlID0gX29ial9hc3NpZ24odGd0LCBfYW9fZmVuY2VfYXBpKTtcbiAgcmV0dXJuIGZ9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX29iaih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV9mbih0Z3QpO1xuICByZXR1cm4ge19fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaVxuICAsIGZlbmNlOiB0Z3QgfHwgZlswXSwgcmVzZXQ6IGZbMV19IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2ZlbmNlX2ZvcmsoZmVuY2UpIHtcbiAgd2hpbGUgKCEgZmVuY2UuZG9uZSkge1xuICAgIGxldCB2ID0gYXdhaXQgZmVuY2UoKTtcbiAgICBpZiAoZmVuY2UuZG9uZSkge1xuICAgICAgcmV0dXJuIHZ9XG4gICAgeWllbGQgdjt9IH1cblxuXG4vLyBleHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBhb19mZW5jZV9tYXJrcyhmZW5jZSwgb3B0KSA6OlxuLy8gICBsZXQge3NpZ25hbCwgdHJhaWxpbmcsIGluaXRpYWx9ID0gb3B0IHx8IHt9XG4vLyAgIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbFxuLy8gICAgID8gZmVuY2UoKSA6IGluaXRpYWxcbi8vXG4vLyAgIHdoaWxlICEgZmVuY2UuZG9uZSA6OlxuLy8gICAgIGxldCB2XG4vLyAgICAgaWYgdHJhaWxpbmcgOjpcbi8vICAgICAgIHYgPSBhd2FpdCBmXG4vLyAgICAgICBmID0gZmVuY2UoKVxuLy9cbi8vICAgICBlbHNlIDo6XG4vLyAgICAgICBmID0gZmVuY2UoKVxuLy8gICAgICAgdiA9IGF3YWl0IGZcbi8vXG4vLyAgICAgaWYgZmVuY2UuZG9uZSA6OlxuLy8gICAgICAgcmV0dXJuIHZcbi8vXG4vLyAgICAgaWYgX2lzX2ZuKHNpZ25hbCkgOjpcbi8vICAgICAgIHlpZWxkIHNpZ25hbCh2KVxuLy8gICAgIGVsc2UgaWYgc2lnbmFsIDo6XG4vLyAgICAgICB5aWVsZCBzaWduYWxcbi8vICAgICBlbHNlIHlpZWxkIHZcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbiwgbm90aWZ5PV9yZXRfaWRlbnQpIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZSQxKGdlbl9pbikpIHtcbiAgICBub3RpZnkodik7fSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gYW9fZHJpdmUoZ2VuX2luLCBnZW5fdGd0LCB4Zm9ybT1fcmV0X2lkZW50KSB7XG4gIGdlbl90Z3QgPSBfeHBpcGVfdGd0KGdlbl90Z3QpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoZ2VuX2luKSkge1xuICAgIGlmICh1bmRlZmluZWQgIT09IGdlbl90Z3QpIHtcbiAgICAgIHYgPSB4Zm9ybSh2KTtcbiAgICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgICBpZiAoZG9uZSkge2JyZWFrfSB9IH0gfVxuXG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgbXVsdGlwbGUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAobXVsdGlwbGUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuZnVuY3Rpb24gYW9fZm9yaygpIHtcbiAgcmV0dXJuIGFvX2ZlbmNlX2ZvcmsodGhpcy5mZW5jZSl9XG5cbmNvbnN0IF9hb190YXBfcHJvcHMgPXtcbiAgYW9fZm9yazp7dmFsdWU6IGFvX2Zvcmt9XG4sIGNoYWluOntnZXQoKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfSB9IH07XG5cbmZ1bmN0aW9uIGFvX3RhcChhZ19vdXQpIHtcbiAgcmV0dXJuIF9vYmpfcHJvcHMoX2FvX3RhcChhZ19vdXQpLCBfYW9fdGFwX3Byb3BzKSB9XG5cbmZ1bmN0aW9uIF9hb190YXAoYWdfb3V0KSB7XG4gIGxldCBbZmVuY2UsIHJlc2V0XSA9IGFvX2ZlbmNlX3YoKTtcbiAgbGV0IGdlbiA9ICgoYXN5bmMgZnVuY3Rpb24gKiAoKSB7XG4gICAgZmVuY2UuZG9uZSA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoYWdfb3V0KSkge1xuICAgICAgICByZXNldCh2KTtcbiAgICAgICAgeWllbGQgdjt9IH1cbiAgICBmaW5hbGx5IHtcbiAgICAgIGZlbmNlLmRvbmUgPSB0cnVlO1xuICAgICAgcmVzZXQoKTt9IH0pLmNhbGwodGhpcykpO1xuXG4gIGdlbi5mZW5jZSA9IGZlbmNlO1xuICByZXR1cm4gZ2VufVxuXG5cblxuY29uc3QgX2FvX3NwbGl0X2FwaSA9e1xuICBnZXQgY2hhaW4oKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfVxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdOiBhb19mb3JrXG4sIGFvX2Zvcmt9O1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IGdlbiA9IF9hb190YXAoYWdfb3V0KTtcbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9hb19zcGxpdF9hcGlcbiAgLCBmaW46IGFvX3J1bihnZW4pXG4gICwgZmVuY2U6IGdlbi5mZW5jZX0gfVxuXG5jb25zdCBfYXNfcGlwZV9lbmQgPSAoZyxucykgPT4gX29ial9hc3NpZ24oZywgbnMpO1xuXG4vL35+flxuLy8gUGlwZSBiYXNlIGFzIGdlbmVyYXRvciBpbiBjb21wb3NlZCBvYmplY3QtZnVuY3Rpb25hbCBpbXBsZW1lbnRhdGlvblxuXG5jb25zdCBfYW9fcGlwZV9iYXNlID17XG4gIHhmb2xkOiB2ID0+IHYgLy8gb24gcHVzaDogaWRlbnRpdHkgdHJhbnNmb3JtXG4sIHhwdWxsKCkge30gLy8gbWVtb3J5OiBub25lXG4sIHhlbWl0OiBfeGludm9rZSQxIC8vIGlkZW50aXR5IHRyYW5zZm9ybSBvciBpbnZva2UgaWYgZnVuY3Rpb25cbiwgeGluaXQoZ19pbiwgYWdfb3V0KSB7fSAvLyBvbiBpbml0OiBkZWZhdWx0IGJlaGF2aW9yXG5cbiwgZ2V0IGNyZWF0ZSgpIHtcbiAgICAvLyBhcyBnZXR0ZXIgdG8gYmluZCBjbGFzcyBhcyBgdGhpc2AgYXQgYWNjZXNzIHRpbWVcbiAgICBjb25zdCBjcmVhdGUgPSAoLi4uIGFyZ3MpID0+XG4gICAgICBfb2JqX2Fzc2lnbih7X19wcm90b19fOiB0aGlzfSxcbiAgICAgICAgLi4uIGFyZ3MubWFwKF94aW52b2tlJDEpKVxuICAgICAgLl9hb19waXBlKCk7XG5cbiAgICByZXR1cm4gY3JlYXRlLmNyZWF0ZSA9IGNyZWF0ZX1cblxuLCBfYW9fcGlwZSgpIHtcbiAgICBsZXQgZmluX2xzdCA9IFtdO1xuICAgIGxldCBzZWxmID17XG4gICAgICBvbl9maW46IGcgPT4oXG4gICAgICAgIGZpbl9sc3QucHVzaChnKVxuICAgICAgLCBnKVxuXG4gICAgLCBzdG9wOiAoKCkgPT4ge1xuICAgICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuICAgICAgICBfZmluX3BpcGUoZmluX2xzdCk7XG4gICAgICAgIHRoaXMuX3Jlc3VtZSgpO30pIH07XG5cbiAgICBsZXQge2tpbmR9ID0gdGhpcztcbiAgICBsZXQgZ19pbiA9IHNlbGYub25fZmluKHRoaXMuX2FvX3BpcGVfaW4oc2VsZi5zdG9wKSk7XG4gICAgbGV0IGFnX291dCA9IHNlbGYub25fZmluKHRoaXMuX2FvX3BpcGVfb3V0KHNlbGYuc3RvcCkpO1xuXG4gICAgc2VsZi5nX2luID0gZ19pbiA9IHRoaXMuX2FzX3BpcGVfaW4oZ19pbiwgc2VsZiwga2luZCk7XG4gICAgYWdfb3V0ID0gdGhpcy5fYXNfcGlwZV9vdXQoYWdfb3V0LCBzZWxmLCBraW5kKTtcblxuICAgIHRoaXMueGluaXQoZ19pbiwgYWdfb3V0KTtcblxuICAgIC8vIGFsbG93IGdfaW4gdG8gaW5pdGlhbGl6ZVxuICAgIGdfaW4ubmV4dCgpO1xuICAgIHJldHVybiBhZ19vdXR9XG5cbiwgX2FzX3BpcGVfaW46IF9hc19waXBlX2VuZFxuLCBfYXNfcGlwZV9vdXQ6IF9hc19waXBlX2VuZFxuXG4sIC8vfn5+XG4gIC8vIFVwc3RyZWFtIGlucHV0IGdlbmVyYXRvclxuICAvLyAgIGRlc2lnbmVkIGZvciBtdWx0aXBsZSBmZWVkZXJzXG5cbiAgKl9hb19waXBlX2luKF9maW5pc2gpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHY7XG4gICAgICB3aGlsZSAoISB0aGlzLmRvbmUpIHtcbiAgICAgICAgdiA9IHRoaXMueGZvbGQoeWllbGQgdik7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2O1xuICAgICAgICBpZiAoMCAhPT0gdGhpcy5fd2FpdGluZyAmJiB1bmRlZmluZWQgIT09IHYpIHtcbiAgICAgICAgICB0aGlzLl9yZXN1bWUoKTt9IH0gfVxuXG4gICAgZmluYWxseSB7XG4gICAgICBfZmluaXNoKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBEb3duc3RyZWFtIGFzeW5jIG91dHB1dCBnZW5lcmF0b3JcbiAgLy8gICBkZXNpZ25lZCBmb3Igc2luZ2xlIGNvbnN1bWVyLlxuXG4gIGFzeW5jICpfYW9fcGlwZV9vdXQoX2ZpbmlzaCkge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcjtcbiAgICAgIHdoaWxlICghIHRoaXMuZG9uZSkge1xuICAgICAgICBpZiAoMCAhPT0gKHIgPSB0aGlzLl93YWl0aW5nKSkge1xuICAgICAgICAgIC8vIHAwOiBleGlzdGluZyB3YWl0ZXJzXG4gICAgICAgICAgciA9IGF3YWl0IHI7XG4gICAgICAgICAgaWYgKHRoaXMuZG9uZSkge2JyZWFrfSB9XG4gICAgICAgIGVsc2UgaWYgKHVuZGVmaW5lZCAhPT0gKHIgPSB0aGlzLnZhbHVlKSkge1xuICAgICAgICAgIC8vIHAxOiBhdmFpbGFibGUgdmFsdWVcbiAgICAgICAgICB0aGlzLnZhbHVlID0gdW5kZWZpbmVkO31cbiAgICAgICAgZWxzZSBpZiAodW5kZWZpbmVkICE9PSAociA9IHRoaXMueHB1bGwoKSkpIHtcbiAgICAgICAgICB9Ly8gcDI6IHhwdWxsIHZhbHVlIChlLmcuIHF1ZXVlIG1lbW9yeSkgXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIHAzOiBhZGQgbmV3IHdhaXRlclxuICAgICAgICAgIHIgPSBhd2FpdCB0aGlzLl9iaW5kX3dhaXRpbmcoKTtcbiAgICAgICAgICBpZiAodGhpcy5kb25lKSB7YnJlYWt9IH1cblxuICAgICAgICB5aWVsZCB0aGlzLnhlbWl0KHIpO30gfVxuXG4gICAgZmluYWxseSB7XG4gICAgICBfZmluaXNoKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBnZW5lcmF0b3ItbGlrZSB2YWx1ZS9kb25lIHN0YXRlc1xuXG4gIHZhbHVlOiB1bmRlZmluZWRcbiwgZG9uZTogZmFsc2VcblxuLCAvL35+flxuICAvLyBwcm9taXNlLWJhc2VkIGZlbmNlIHRhaWxvcmVkIGZvciBhb19waXBlIHVzZWNhc2VcblxuICBfd2FpdGluZzogMFxuLCBfZnVsZmlsbCgpIHt9XG4sIGFzeW5jIF9yZXN1bWUoKSB7XG4gICAgaWYgKCEgdGhpcy5kb25lKSB7YXdhaXQgdGhpczt9XG5cbiAgICBsZXQge3ZhbHVlLCBfZnVsZmlsbH0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgIT0gdmFsdWUgfHwgdGhpcy5kb25lKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fd2FpdGluZyA9IDA7XG4gICAgICBfZnVsZmlsbCh2YWx1ZSk7fSB9XG5cbiwgX2JpbmRfd2FpdGluZygpIHtcbiAgICBsZXQgX3Jlc2V0ID0geSA9PiB0aGlzLl9mdWxmaWxsID0geTtcbiAgICB0aGlzLl9iaW5kX3dhaXRpbmcgPSAoKSA9PiB0aGlzLl93YWl0aW5nIHx8KFxuICAgICAgdGhpcy5fd2FpdGluZyA9IG5ldyBQcm9taXNlKF9yZXNldCkpO1xuICAgIHJldHVybiB0aGlzLl9iaW5kX3dhaXRpbmcoKX0gfTtcblxuXG5mdW5jdGlvbiBfZmluX3BpcGUoZmluX2xzdCkge1xuICB3aGlsZSAoMCAhPT0gZmluX2xzdC5sZW5ndGgpIHtcbiAgICBsZXQgZyA9IGZpbl9sc3QucG9wKCk7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChfaXNfZm4oZykpIHtnKCk7fVxuICAgICAgZWxzZSBnLnJldHVybigpO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgVHlwZUVycm9yKSB7XG4gICAgICAgIGlmICgnR2VuZXJhdG9yIGlzIGFscmVhZHkgcnVubmluZycgPT09IGVyci5tZXNzYWdlKSB7XG4gICAgICAgICAgY29udGludWV9IH1cbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTt9IH0gfVxuXG5jb25zdCBfYW9fcGlwZV9pbl9hcGkgPXtcbiAgYXNfcGlwZV9pbihzZWxmLCBnX2luKSB7fVxuXG4sIHdpdGhfY3R4KHhjdHgpIHtcbiAgICBpZiAoX2lzX2ZuKHhjdHgpKSB7XG4gICAgICB4Y3R4ID0geGN0eCh0aGlzKTt9XG5cbiAgICBpZiAoeGN0eCAmJiB4Y3R4Lm5leHQpIHtcbiAgICAgIHhjdHgubmV4dCh0aGlzKTtcbiAgICAgIHRoaXMub25fZmluKHhjdHgpO31cbiAgICByZXR1cm4geGN0eH1cblxuLCBmZWVkKHhzcmMsIHhmb3JtKSB7XG4gICAgcmV0dXJuIGFvX2RyaXZlKHhzcmMsIHRoaXMsIHhmb3JtKX1cblxuLCBiaW5kX3ZlYyguLi4ga2V5cykge1xuICAgIHJldHVybiB2ID0+IHRoaXMubmV4dChbLi4ua2V5cywgdl0pIH1cblxuLCBiaW5kX29iaihrZXksIG5zKSB7XG4gICAgcmV0dXJuIHYgPT4gdGhpcy5uZXh0KHsuLi5ucywgW2tleV06IHZ9KSB9IH07XG5cbmZ1bmN0aW9uIF9hb19waXBlX2luKGdfaW4sIHNlbGYpIHtcbiAgcmV0dXJuIF9vYmpfYXNzaWduKGdfaW4sIF9hb19waXBlX2luX2FwaSwgc2VsZil9XG5cbmNvbnN0IF9hb19waXBlX291dF9raW5kcyA9e1xuICBhb19yYXc6IGcgPT4gZ1xuLCBhb19zcGxpdDogYW9fc3BsaXRcbiwgYW9fdGFwOiBhb190YXB9O1xuXG5mdW5jdGlvbiBfYW9fcGlwZV9vdXQoYWdfb3V0LCBzZWxmLCBraW5kKSB7XG4gIGtpbmQgPSAvXmFvXy8udGVzdChraW5kKSA/IGtpbmQgOiAnYW9fJytraW5kO1xuICBsZXQgYW9fd3JhcCA9IF9hb19waXBlX291dF9raW5kc1traW5kXTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gYW9fd3JhcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm9ud24gYW9fcGlwZV9vdXQga2luZCBcIiR7a2luZH1cImApfVxuXG4gIHJldHVybiBfb2JqX2Fzc2lnbihhb193cmFwKGFnX291dCksIHNlbGYpIH1cblxuY29uc3QgX2FvX3BpcGUgPXtcbiAgX19wcm90b19fOiBfYW9fcGlwZV9iYXNlXG5cbiwgLy8geGZvbGQ6IHYgPT4gdiAtLSBvbiBwdXNoOiBpZGVudGl0eSB0cmFuc2Zvcm1cbiAgLy8geHB1bGwoKSB7fSAtLSBtZW1vcnk6IG5vbmVcbiAgLy8geGVtaXQ6IF94aW52b2tlIC0tIGlkZW50aXR5IHRyYW5zZm9ybSBvciBpbnZva2UgaWYgZnVuY3Rpb25cblxuICAvLyAqeGdmb2xkKCkgLS0gb24gcHVzaDogZ2VuZXJhdG9yLWJhc2VkIGZvbGQgaW1wbFxuICAvLyAqeHNyYygpIC0tIGZlZWQgd2l0aCBzb3VyY2UgZ2VuZXJhdG9yXG4gIC8vICp4Y3R4KGdlbl9zcmMpIC0tIG9uIGluaXQ6IGJpbmQgZXZlbnQgc291cmNlc1xuXG4gIGtpbmQ6ICdzcGxpdCdcbiwgX2FzX3BpcGVfaW46IF9hb19waXBlX2luXG4sIF9hc19waXBlX291dDogX2FvX3BpcGVfb3V0XG5cbiwgeGluaXQoZ19pbikge1xuICAgIGxldCB4Z2ZvbGQgPSB0aGlzLnhnZm9sZDtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Z2ZvbGQpIHtcbiAgICAgIHRoaXMuX2luaXRfeGdmb2xkKGdfaW4sIHhnZm9sZCk7fVxuXG4gICAgdGhpcy5faW5pdF9jaGFpbihnX2luKTt9XG5cblxuLCBfaW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKSB7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0geGdmb2xkKSB7XG4gICAgICByZXR1cm59XG5cbiAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgIHhnZm9sZCA9IHhnZm9sZC5jYWxsKHRoaXMsIHRoaXMpO1xuXG4gICAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgICAgdGhpcy54Zm9sZCA9IHhnZm9sZDtcbiAgICAgICAgcmV0dXJuIHRydWV9XG5cbiAgICAgIHhnZm9sZC5uZXh0KCk7fVxuXG4gICAgdGhpcy54Z2ZvbGQgPSB4Z2ZvbGQ7XG4gICAgdGhpcy54Zm9sZCA9IHRoaXMuX2ZvbGRfZ2VuO1xuICAgIGdfaW4ub25fZmluKHhnZm9sZCk7XG4gICAgcmV0dXJuIHRydWV9XG5cbiwgX2ZvbGRfZ2VuKHYpIHtcbiAgICBsZXQge2RvbmUsIHZhbHVlfSA9IHRoaXMueGdmb2xkLm5leHQodik7XG4gICAgaWYgKGRvbmUpIHt0aGlzLmRvbmUgPSB0cnVlO31cbiAgICByZXR1cm4gdmFsdWV9XG5cblxuLCBfaW5pdF9jaGFpbihnX2luKSB7XG4gICAgbGV0IHt4c3JjLCB4Y3R4fSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geHNyYykge1xuICAgICAgZ19pbi5mZWVkKHhzcmMpXG4gICAgICAgIC50aGVuICgoKSA9PmdfaW4ucmV0dXJuKCkpOyB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Y3R4KSB7XG4gICAgICBnX2luLndpdGhfY3R4KHhjdHgpO30gfSB9O1xuXG5cbmNvbnN0IGFvX3BpcGUgPSBfYW9fcGlwZS5jcmVhdGU7XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDApIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc2V0LCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2ZlbmNlLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBnZW5faW4pIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLmZpbiA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoZ2VuX2luKSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIHYpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzZXQpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBhb19kb21fZXZlbnRzID1cbiAgX3dtX3BpcGVfY2xvc3VyZShfYW9fZG9tX2V2ZW50c19jdHgpO1xuXG5mdW5jdGlvbiBfYW9fZG9tX2V2ZW50c19jdHgoZ19pbikge1xuICByZXR1cm4ge19fcHJvdG9fXzogX2RvbV9ldmVudHNfYXBpXG4gICwgd21fZWxlbXM6IG5ldyBXZWFrTWFwKClcbiAgLCBlbWl0OiBpbmZvID0+IGdfaW4ubmV4dChpbmZvKX0gfVxuXG5cbmNvbnN0IF9kb21fZXZlbnRzX2FwaSA9e1xuICAvLyB3bV9lbGVtczogbmV3IFdlYWtNYXAoKVxuICAvLyBlbWl0OiBpbmZvID0+IGdfaW4ubmV4dChpbmZvKVxuXG4gIGxpc3RlbihlbGVtLCBldnQsIHhmbiwgZXZ0X29wdCkge1xuICAgIGxldCB7ZW1pdCwgaW5mb30gPSB0aGlzO1xuICAgICB7XG4gICAgICBsZXQgZW0gPSBfd21faXRlbSh0aGlzLndtX2VsZW1zLCBlbGVtLCBfZWxlbV9tYXBfZW50cnkpO1xuICAgICAgaW5mbyA9ey4uLiBpbmZvLCAuLi4gZW0uaW5mbywgZXZ0fTtcblxuICAgICAgbGV0IGV2dDAgPSBldnQuc3BsaXQoL1tfLl0vLCAxKVswXTtcbiAgICAgIGlmICgnaW5pdCcgPT09IGV2dDApIHtcbiAgICAgICAgZXZ0X2ZuKGVsZW0pO1xuICAgICAgICByZXR1cm4gdGhpc31cblxuICAgICAgbGV0IG9sZF9mbiA9IGVtLmdldChldnQpO1xuXG4gICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoZXZ0MCwgZXZ0X2ZuLCBldnRfb3B0KTtcbiAgICAgIGVtLnNldChldnQsIGV2dF9mbik7XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IG9sZF9mbikge1xuICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZ0MCwgb2xkX2ZuKTsgfVxuXG4gICAgICBpZiAoJ21lc3NhZ2UnID09PSBldnQwICYmIF9pc19mbihlbGVtLnN0YXJ0KSkge1xuICAgICAgICBlbGVtLnN0YXJ0KCk7fSB9XG5cbiAgICByZXR1cm4gdGhpc1xuXG4gICAgZnVuY3Rpb24gZXZ0X2ZuKGUpIHtcbiAgICAgIGxldCB2ID0geGZuKGUsIGVtaXQsIGluZm8pO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gdikge1xuICAgICAgICBlbWl0KHsuLi4gaW5mbywgdn0pOyB9IH0gfVxuXG5cbiwgcmVtb3ZlKGVsZW0sIC4uLiBrZXlzKSB7XG4gICAgbGV0IHt3bV9lbGVtc30gPSB0aGlzO1xuICAgIGxldCBldnRfbWFwID0gd21fZWxlbXMuZ2V0KGVsZW0pIHx8IG5ldyBNYXAoKTtcblxuICAgIGxldCBldl9wYWlycztcbiAgICBpZiAoMCA9PT0ga2V5cy5sZW5ndGgpIHtcbiAgICAgIHdtX2VsZW1zLmRlbGV0ZShlbGVtKTtcbiAgICAgIGV2X3BhaXJzID0gZXZ0X21hcC5lbnRyaWVzKCk7fVxuXG4gICAgZWxzZSB7XG4gICAgICBldl9wYWlycyA9IGtleXMubWFwKFxuICAgICAgICBldnQwID0+IFtldnQwLCBldnRfbWFwLmdldChldnQwKV0pOyB9XG5cbiAgICBmb3IgKGxldCBbZXZ0MCwgZXZ0X2ZuXSBvZiBldl9wYWlycykge1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZXZ0X2ZuKSB7XG4gICAgICAgIGV2dF9tYXAuZGVsZXRlKGV2dDApO1xuICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZ0MCwgZXZ0X2ZuKTt9IH1cbiAgICByZXR1cm4gdGhpc31cblxuXG4sIHNldF9pbmZvKGVsLCBpbmZvKSB7XG4gICAgbGV0IGVtID0gX3dtX2l0ZW0odGhpcy53bV9lbGVtcywgZWwsIF9lbGVtX21hcF9lbnRyeSk7XG4gICAgX29ial9hc3NpZ24oZW0uaW5mbywgaW5mbyk7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgd2l0aCguLi4gbnNfYXJncykge1xuICAgIGxldCB7bGlzdGVuLCBzZXRfaW5mbywgaW5mb30gPSB0aGlzO1xuICAgIHNldF9pbmZvID0gc2V0X2luZm8uYmluZCh0aGlzKTtcblxuICAgIGZvciAobGV0IG5zIG9mIG5zX2FyZ3MpIHtcbiAgICAgIGxldCBuc190aGlzID0gdW5kZWZpbmVkID09PSBucy5pbmZvID8gdGhpcyA6XG4gICAgICAgIHtfX3Byb3RvX186IHRoaXMsIGluZm86ey4uLiBpbmZvLCAuLi4gbnMuaW5mb319O1xuXG4gICAgICBsZXQgZXZlbnRzID1bLi4uIF9pdGVyX2V2ZW50X2xpc3QobnMpXTtcbiAgICAgIGZvciAobGV0IGVsZW0gb2YgX2l0ZXJfbmFtZWRfZWxlbXMobnMuJCwgc2V0X2luZm8pKSB7XG4gICAgICAgIGZvciAobGV0IGV2dF9hcmdzIG9mIGV2ZW50cykge1xuICAgICAgICAgIGxpc3Rlbi5jYWxsKG5zX3RoaXMsIGVsZW0sIC4uLiBldnRfYXJncyk7fSB9IH1cblxuICAgIHJldHVybiB0aGlzfSB9O1xuXG5cbmZ1bmN0aW9uIF9lbGVtX21hcF9lbnRyeShlbGVtKSB7XG4gIGxldCBrID0gZWxlbS5uYW1lIHx8IGVsZW0uaWRcbiAgICB8fCAoZWxlbS50eXBlIHx8IGVsZW0udGFnTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKVxuICAgIHx8IGVsZW1bU3ltYm9sLnRvU3RyaW5nVGFnXTtcblxuICBsZXQgbSA9IG5ldyBNYXAoKTtcbiAgbS5pbmZvID17ZG9tX2l0ZW06IGssIGt9O1xuICByZXR1cm4gbX1cblxuXG5mdW5jdGlvbiAqIF9pdGVyX25hbWVkX2VsZW1zKGxzdCwgc2V0X2luZm8pIHtcbiAgbHN0ID0gX2lzX2FycmF5KGxzdCkgPyBsc3RcbiAgICA6IGxzdC5hZGRFdmVudExpc3RlbmVyID8gW2xzdF1cbiAgICA6IE9iamVjdC5lbnRyaWVzKGxzdCk7XG5cbiAgZm9yIChsZXQgZWEgb2YgbHN0KSB7XG4gICAgaWYgKF9pc19hcnJheShlYSkpIHtcbiAgICAgIHNldF9pbmZvKGVhWzFdLCB7azogZWFbMF19KTtcbiAgICAgIHlpZWxkIGVhWzFdO31cblxuICAgIGVsc2UgeWllbGQgZWE7fSB9XG5cblxuZnVuY3Rpb24gKiBfaXRlcl9ldmVudF9saXN0KG5zKSB7XG4gIGZvciAobGV0IFthdHRyLCBlZm5dIG9mIE9iamVjdC5lbnRyaWVzKG5zKSkge1xuICAgIGlmICghIGVmbiB8fCAvW15hLXpdLy50ZXN0KGF0dHIpKSB7XG4gICAgICBjb250aW51ZX1cblxuICAgIGF0dHIgPSBhdHRyLnJlcGxhY2UoJ18nLCAnLicpO1xuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZWZuKSB7XG4gICAgICB5aWVsZCBbYXR0ciwgZWZuLCBlZm4uZXZ0X29wdF07fVxuXG4gICAgZWxzZSBpZiAoZWZuLm9uX2V2dCB8fCBlZm4uZXZ0X29wdCkge1xuICAgICAgeWllbGQgW2F0dHIsIGVmbi5vbl9ldnQsIGVmbi5ldnRfb3B0XTt9IH0gfVxuXG5leHBvcnQgeyBfYW9fZG9tX2V2ZW50c19jdHgsIF9hb19waXBlLCBfYW9fcGlwZV9iYXNlLCBfYW9fcGlwZV9pbiwgX2FvX3BpcGVfaW5fYXBpLCBfYW9fcGlwZV9vdXQsIF9hb19waXBlX291dF9raW5kcywgX2FvX3RhcCwgX2RvbV9ldmVudHNfYXBpLCBfd21fY2xvc3VyZSwgX3dtX2l0ZW0sIF93bV9waXBlX2Nsb3N1cmUsIF94aW52b2tlJDEgYXMgX3hpbnZva2UsIF94cGlwZV90Z3QsIGFvX2RlYm91bmNlLCBhb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2V2ZW50cywgYW9fZHJpdmUsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9mb3JrLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX3YsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19waXBlLCBhb19ydW4sIGFvX3NwbGl0LCBhb19zdGVwX2l0ZXIsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGZuX2NoYWluLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZXN9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3BpcGUsIGFvX2RvbV9ldmVudHN9IGZyb20gJ3JvYXAnXG5cbmNvbnN0IGFvX3RndCA9IGFvX3BpcGUoKVxuXG5hb19kb21fZXZlbnRzKGFvX3RndCkud2l0aCBAOlxuICAkOiB3aW5kb3dcbiAgc3RvcmFnZShldnQpIDo6XG4gICAgbGV0IHtrZXksIG9sZFZhbHVlLCBuZXdWYWx1ZSwgdXJsfSA9IGV2dFxuICAgIHJldHVybiBAe30ga2V5LCBvbGRWYWx1ZSwgbmV3VmFsdWUsIHVybFxuXG5cbjo6IT5cbiAgbGV0IGVsX291dHB1dCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ291dHB1dCcpXG4gIGZvciBhd2FpdCBsZXQgZSBvZiBhb190Z3QgOjpcbiAgICBjb25zb2xlLmxvZyBAICdhb190Z3Q6JywgZVxuXG4gICAgbGV0IGVsX3ByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ByZScpXG4gICAgZWxfcHJlLnRleHRDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoZSwgbnVsbCwgMilcbiAgICBlbF9vdXRwdXQuYXBwZW5kQ2hpbGQoZWxfcHJlKVxuXG5cbjo6IT5cbiAgbGV0IHRhYl9pZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gIGZvciBhd2FpdCBsZXQgdHMgb2YgYW9fdGltZXMgQCBhb19pbnRlcnZhbCgxMDAwKSA6OlxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtIEAgdGFiX2lkLCBAW10gdGFiX2lkLCB0c1xuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTTtBQUNOLEVBQUUsTUFBTSxFQUFFLFdBQVc7QUFDckIsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVO0FBQzlCLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDWDtBQUNBLE1BQU07QUFDTixFQUFFLE9BQU8sRUFBRSxTQUFTO0FBQ3BCLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDVjtBQUNBLE1BQU0sVUFBVSxHQUFHLENBQUM7QUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztBQUNBLE1BQU0sTUFBTSxHQUFHLElBQUk7QUFDbkIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0FBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxQjtBQUNBLE1BQU0sVUFBVSxHQUFHLElBQUk7QUFDdkIsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ2QsTUFBTSxJQUFJLEVBQUU7QUFDWixNQUFNLElBQUksQ0FB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QUFDaEIsSUFBSSxPQUFPLE1BQU0sQ0FBQztBQUNsQjtBQUNBLEVBQUUsV0FBVyxFQUFFLFlBQVk7QUFDM0IsRUFBRSxZQUFZLEVBQUUsWUFBWTtBQUM1QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7QUFDeEIsSUFBSSxJQUFJO0FBQ1IsTUFBTSxJQUFJLENBQUMsQ0FBQztBQUNaLE1BQU0sT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDMUIsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFFBQVEsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDdkIsUUFBUSxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsUUFBUSxJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUU7QUFDcEQsVUFBVSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDOUI7QUFDQSxZQUFZO0FBQ1osTUFBTSxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxPQUFPLFlBQVksQ0FBQyxPQUFPLEVBQUU7QUFDL0IsSUFBSSxJQUFJO0FBQ1IsTUFBTSxJQUFJLENBQUMsQ0FBQztBQUNaLE1BQU0sT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDMUIsUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQ3ZDO0FBQ0EsVUFBVSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFDdEIsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNsQyxhQUFhLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDakQ7QUFDQSxVQUFVLElBQUksQ0FBQyxLQUFLLEdBQUcsU0FB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
