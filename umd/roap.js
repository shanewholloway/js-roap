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



  function * iter(iterable) {
    yield * iterable;}

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


  async function * ao_iter(iterable) {
    yield * iterable;}

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

  function ao_split(iterable) {
    let f_out = ao_fence_obj();
    f_out.when_run = _ao_run(iterable, f_out);
    f_out.g_in = iterable.g_in;
    return f_out}

  async function _ao_run(iterable, g_tap) {
    try {
      for await (let v of iterable) {
        g_tap.next(v);} }

    catch (err) {
      ao_check_done(err);}

    finally {
      g_tap.return();} }


  function ao_tap(iterable) {
    let f_tap = ao_fence_obj();
    let ag_tap = _ao_tap(iterable, f_tap);
    ag_tap.f_tap = ag_tap.f_out = f_tap;
    ag_tap.g_in = f_tap.g_in = iterable.g_in;
    return [f_tap, ag_tap]}

  async function * _ao_tap(iterable, g_tap) {
    try {
      for await (let v of iterable) {
        g_tap.next(v);
        yield v;} }

    catch (err) {
      ao_check_done(err);}

    finally {
      g_tap.return();} }

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

  const ao_xform = ns_gen => ao_fence_in().ao_xform(ns_gen);
  const ao_fold = ns_gen => ao_fence_in().ao_fold(ns_gen);
  const ao_queue = ns_gen => ao_fence_in().ao_queue(ns_gen);

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

  function ao_interval(ms=1000, gen_in) {
    let [_fence, _resume, _abort] = ao_fence_fn();
    let tid = setInterval(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    _fence.stop = (() => {
      tid = clearInterval(tid);
      _abort();});

    return null == gen_in ? _fence
      : ao_iter_fenced(gen_in, _fence)}


  function ao_timeout(ms=1000, gen_in) {
    let tid, [_fence, _resume] = ao_fence_fn(timeout);

    return null == gen_in ? timeout
      : ao_iter_fenced(gen_in, timeout)

    function timeout() {
      tid = setTimeout(_resume, ms, 1);
      if (tid.unref) {tid.unref();}
      return _fence()} }


  function ao_debounce(ms=300, gen_in) {
    let tid, [_fence, _resume] = ao_fence_fn();

    _fence.fin = ((async () => {
      try {
        let p;
        for await (let v of gen_in) {
          clearTimeout(tid);
          p = _fence();
          tid = setTimeout(_resume, ms, v);}

        await p;}
      catch (err) {
        ao_check_done(err);} })());

    return _fence}


  async function * ao_times(gen_in) {
    let ts0 = Date.now();
    for await (let v of gen_in) {
      yield Date.now() - ts0;} }

  function ao_dom_animation(gen_in) {
    let tid, [_fence, _resume] = ao_fence_fn(raf);
    raf.stop = (() => {
      tid = cancelAnimationFrame(tid);
      raf.done = true;});

    return null == gen_in ? raf
      : ao_iter_fenced(gen_in, raf)

    function raf() {
      tid = requestAnimationFrame(_resume);
      return _fence()} }

  const _evt_init = Promise.resolve({type:'init'});
  function ao_dom_listen(self=ao_queue()) {
    return _bind.self = self ={
      __proto__: self
    , with_dom(dom, fn) {
        return dom.addEventListener
          ? _ao_with_dom(_bind, fn, dom)
          : _ao_with_dom_vec(_bind, fn, dom)} }

    function _bind(dom, fn_evt, fn_dom) {
      return evt => {
        let v = fn_evt
          ? fn_evt(evt, dom, fn_dom)
          : fn_dom(dom, evt);

        if (null != v) {
          self.g_in.next(v);} } } }


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

  exports._ao_fence_core_api_ = _ao_fence_core_api_;
  exports._ao_fence_gen_api_ = _ao_fence_gen_api_;
  exports._ao_run = _ao_run;
  exports._ao_tap = _ao_tap;
  exports._xf_gen = _xf_gen;
  exports.ao_check_done = ao_check_done;
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
  exports.ao_fence_out = ao_fence_out;
  exports.ao_fence_v = ao_fence_v;
  exports.ao_fold = ao_fold;
  exports.ao_interval = ao_interval;
  exports.ao_iter = ao_iter;
  exports.ao_iter_fenced = ao_iter_fenced;
  exports.ao_queue = ao_queue;
  exports.ao_run = ao_run;
  exports.ao_split = ao_split;
  exports.ao_step_iter = ao_step_iter;
  exports.ao_tap = ao_tap;
  exports.ao_timeout = ao_timeout;
  exports.ao_times = ao_times;
  exports.ao_xform = ao_xform;
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
