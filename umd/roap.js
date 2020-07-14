(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.roap = {}));
}(this, (function (exports) { 'use strict';

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

  function * iter(gen_in) {
    yield * _xinvoke$1(gen_in);}

  async function * ao_iter(gen_in) {
    yield * _xinvoke$1(gen_in);}


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

  function _wm_closure(wm_absent) {
    let wm = new WeakMap();
    return key =>
      _wm_item(wm,
        key, wm_absent) }

  function _wm_item(wm, wm_key, wm_absent) {
    let item = wm.get(wm_key);
    if (undefined === item) {
      item = wm_absent(wm_key);
      wm.set(wm_key, item);}
    return item}

  const ao_deferred_v = ((() => {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , [p, y, n]) })());

  const ao_deferred = v =>(
    v = ao_deferred_v()
  , {promise: v[0], resolve: v[1], reject: v[2]});

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
      for await (let v of _xinvoke(gen_in)) {
        clearTimeout(tid);
        tid = setTimeout(_reset, ms, v);} })());

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

  exports._ao_dom_events_ctx = _ao_dom_events_ctx;
  exports._ao_pipe = _ao_pipe;
  exports._ao_pipe_base = _ao_pipe_base;
  exports._ao_pipe_in = _ao_pipe_in;
  exports._ao_pipe_in_api = _ao_pipe_in_api;
  exports._ao_pipe_out = _ao_pipe_out;
  exports._ao_pipe_out_kinds = _ao_pipe_out_kinds;
  exports._ao_tap = _ao_tap;
  exports._dom_events_api = _dom_events_api;
  exports._wm_closure = _wm_closure;
  exports._wm_item = _wm_item;
  exports._wm_pipe_closure = _wm_pipe_closure;
  exports._xinvoke = _xinvoke$1;
  exports._xpipe_tgt = _xpipe_tgt;
  exports.ao_debounce = ao_debounce;
  exports.ao_deferred = ao_deferred;
  exports.ao_deferred_v = ao_deferred_v;
  exports.ao_dom_animation = ao_dom_animation;
  exports.ao_dom_events = ao_dom_events;
  exports.ao_drive = ao_drive;
  exports.ao_fence_fn = ao_fence_fn;
  exports.ao_fence_fork = ao_fence_fork;
  exports.ao_fence_obj = ao_fence_obj;
  exports.ao_fence_v = ao_fence_v;
  exports.ao_interval = ao_interval;
  exports.ao_iter = ao_iter;
  exports.ao_pipe = ao_pipe;
  exports.ao_run = ao_run;
  exports.ao_split = ao_split;
  exports.ao_step_iter = ao_step_iter;
  exports.ao_tap = ao_tap;
  exports.ao_timeout = ao_timeout;
  exports.ao_times = ao_times;
  exports.fn_chain = fn_chain;
  exports.is_ao_iter = is_ao_iter;
  exports.iter = iter;
  exports.step_iter = step_iter;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=roap.js.map
