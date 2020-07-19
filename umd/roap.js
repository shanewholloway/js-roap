(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.roap = {}));
}(this, (function (exports) { 'use strict';

  const is_ao_iter = g =>
    null != g[Symbol.asyncIterator];

  const is_ao_fn = v_fn =>
    'function' === typeof v_fn
      && ! is_ao_iter(v_fn);


  const ao_done = Object.freeze({ao_done: true});
  const ao_check_done$1 = err => {
    if (err !== ao_done && err && !err.ao_done) {
      throw err}
    return true};


  function * iter(gen_in) {
    yield * gen_in;}
  async function * ao_iter(gen_in) {
    yield * gen_in;}


  function fn_chain(tail) {
    chain.tail = tail;
    return chain.chain = chain
    function chain(fn) {
      chain.tail = fn(chain.tail);
      return chain} }

  const ao_deferred_v = ((() => {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , [p, y, n]) })());

  const ao_deferred = v =>(
    v = ao_deferred_v()
  , {promise: v[0], resolve: v[1], reject: v[2]});

  async function ao_run(gen_in) {
    for await (let v of gen_in) {} }


  async function ao_drive(gen_in, gen_tgt, close_tgt) {
    if (is_ao_fn(gen_tgt)) {
      gen_tgt = gen_tgt();
      gen_tgt.next();}

    for await (let v of gen_in) {
      let {done} = await gen_tgt.next(v);
      if (done) {break} }

    if (close_tgt) {
      await gen_tgt.return();} }


  function ao_step_iter(iterable, or_more) {
    iterable = ao_iter(iterable);
    return {
      async * [Symbol.asyncIterator]() {
        do {
          let {value, done} = await iterable.next();
          if (done) {return value}
          yield value;}
        while (or_more) } } }


  function step_iter(iterable, or_more) {
    iterable = iter(iterable);
    return {
      *[Symbol.iterator]() {
        do {
          let {value, done} = iterable.next();
          if (done) {return value}
          yield value;}
        while (or_more) } } }

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

    , ao_check_done: ao_check_done$1
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
        ao_check_done$1(err);} } };


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
        ao_check_done$1(err);}
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
    ag_tap.f_out = f_tap;
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
      ao_check_done$1(err);}
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
      ao_check_done$1(err);}
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

  function ao_interval(ms=1000) {
    let [_fence, _resume, _abort] = ao_fence_fn();
    let tid = setInterval(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    _fence.stop = (() => {
      tid = clearInterval(tid);
      _fence.done = true;
      _abort();});
    return _fence}


  function ao_timeout(ms=1000) {
    let tid, [_fence, _resume] = ao_fence_fn(timeout);
    return timeout

    function timeout() {
      tid = setTimeout(_resume, ms, 1);
      if (tid.unref) {tid.unref();}
      return _fence()} }


  function ao_debounce(ms=300, gen_in) {
    let tid, [_fence, _resume] = ao_fence_fn();

    _fence.fin = ((async () => {
      let p;
      for await (let v of gen_in) {
        clearTimeout(tid);
        if (_fence.done) {return}
        p = _fence();
        tid = setTimeout(_resume, ms, v);}

      await p;
      _fence.done = true;})());

    return _fence}


  async function * ao_times(gen_in) {
    let ts0 = Date.now();
    for await (let v of gen_in) {
      yield Date.now() - ts0;} }

  function ao_dom_animation() {
    let tid, [_fence, _resume] = ao_fence_fn(raf);
    raf.stop = (() => {
      tid = cancelAnimationFrame(tid);
      raf.done = true;});
    return raf

    function raf() {
      tid = requestAnimationFrame(_resume);
      return _fence()} }

  const _evt_init = Promise.resolve({type:'init'});
  function ao_dom_listen(pipe = ao_fence_in().ao_queue()) {
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
    if (is_ao_fn(fn)) {
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

  exports._ao_fence_api_ = _ao_fence_api_;
  exports._ao_tap = _ao_tap;
  exports._xf_gen = _xf_gen;
  exports.ao_check_done = ao_check_done$1;
  exports.ao_debounce = ao_debounce;
  exports.ao_deferred = ao_deferred;
  exports.ao_deferred_v = ao_deferred_v;
  exports.ao_dom_animation = ao_dom_animation;
  exports.ao_dom_listen = ao_dom_listen;
  exports.ao_done = ao_done;
  exports.ao_drive = ao_drive;
  exports.ao_fence_fn = ao_fence_fn;
  exports.ao_fence_in = ao_fence_in;
  exports.ao_fence_obj = ao_fence_obj;
  exports.ao_fence_v = ao_fence_v;
  exports.ao_interval = ao_interval;
  exports.ao_iter = ao_iter;
  exports.ao_run = ao_run;
  exports.ao_split = ao_split;
  exports.ao_step_iter = ao_step_iter;
  exports.ao_tap = ao_tap;
  exports.ao_timeout = ao_timeout;
  exports.ao_times = ao_times;
  exports.aog_iter = aog_iter;
  exports.aog_sink = aog_sink;
  exports.fn_chain = fn_chain;
  exports.is_ao_fn = is_ao_fn;
  exports.is_ao_iter = is_ao_iter;
  exports.iter = iter;
  exports.step_iter = step_iter;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=roap.js.map
