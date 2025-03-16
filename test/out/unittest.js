(function () {
  'use strict';

  const { assert, expect } = require('chai');

  const delay = (ms=1) => 
    new Promise(y =>
      setTimeout(y, ms, 'timeout') );

  const delay_race = (p, ms=1) => 
    Promise.race([p, delay(ms)]);

  async function * delay_walk(g_in, ms=1) {
    await delay(ms);
    for await (let v of g_in) {
      yield v;
      await delay(ms);} }

  function is_fn(fn) {
    expect(fn).to.be.a('function');
    return fn}

  function is_gen(g) {
    is_fn(g.next);
    is_fn(g.return);
    is_fn(g.throw);
    return g}

  function is_fence_core(f) {
    is_fn(f.fence);
    is_fn(f.ao_fork);
    is_async_iterable(f);

    is_fn(f.ao_check_done);
    // is_fn(f.chain) -- moved to experimental/chain.md
    return f}

  function is_fence_gen(f) {
    is_fence_core(f);
    is_fn(f.abort);
    is_fn(f.resume);

    is_gen(f);
    return f}

  function is_async_iterable(o) {
    assert(null != o[Symbol.asyncIterator], 'async iterable');
    return o}

  async function array_from_ao_iter(g) {
    let res = [];
    for await (let v of g) {
      res.push(v);}
    return res}

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

  function ao_when_map(ao_fn_v, db=new Map(), reject_deleted) {
    let idx_del = reject_deleted ? 2 : 1;
    return {
      has: k => db.has(k)
    , get: k => at(k)[0] // promise of deferred
    , set: define, define
    , delete(k) {
        let b, e = db.get(k);
        if (b = (undefined !== e)) {
          db.delete(k);
          e[idx_del](); }// e.g. resolve(undefined)
        return b}
    , clear() {
        // "delete" remaining on next promise tick
        p = Promise.resolve();
        for (let e of db.values()) {
          p.then(e[idx_del]); }// e.g. resolve (undefined)

        db.clear(); } }// clear db

    function at(k) {
      let e = db.get(k);
      if (undefined === e) {
        db.set(k, e=ao_fn_v());}
      return e}

    function define(k, v) {
      let [p, fn_fulfill] = at(k);
      fn_fulfill(v); // e.g. deferred's resolve(v) or fence's resume(v)
      return p } }// promise of deferred

  function ao_defer_ctx(as_res = (...args) => args) {
    // avoid garbage collecting _pset by using a closure over local variables
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      // create the promise and immediately capture locally set closure variables from _pset optimization
      p = new Promise(_pset)
    , as_res(p, y, n)) }

  const ao_defer_v = /* #__PURE__ */
    ao_defer_ctx();

  const ao_defer_o = /* #__PURE__ */
    ao_defer_ctx((p,y,n) =>
      ({promise: p, resolve: y, reject: n}));

  const ao_defer_when = db =>
    ao_when_map(ao_defer_v, db);

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
    return (yield * iterable)}

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
    return (yield * iterable)}


  async function * _ao_iter_fenced(iterable, f_gate, initial=false) {
    let f = true === initial ? f_gate.fence() : initial;
    for await (let v of iterable) {
      await f;
      yield v;
      f = f_gate.fence();} }


  const ao_iter_fenced = (...args) =>
    _ag_copy(args[0], _ao_iter_fenced(...args));

  function ao_fence_o(proto) {
    let r = ao_fence_v();
    return {__proto__: proto,
      fence: r[0], resume: r[1], abort: r[2]} }

  function ao_fence_v() {
    let x, p=0; // x is the current deferred; p is the promise or 0
    // when p is 0, calling fence() resets the system; otherwise p is the currently awaited promise
    let fence  = () => ( 0!==p ? p : p=(x=ao_defer_v())[0] );
    // when p is not 0, resolve deferred in x
    let resume = ans => { if (0!==p) { p=0; x[1](ans); }};
    // when p is not 0, reject deferred in x
    let abort  = err => { if (0!==p) { p=0; x[2](err || ao_done); }};
    return [fence, resume, abort] }


  const ao_fence_when = db =>
    ao_when_map(ao_fence_v, db);

  async function * ao_iter_fence(fence) {
    try {
      while (1) {
        let r = await fence();
        if (undefined !== r) {
          yield r;} } }
    catch (err) {
      ao_check_done(err);} }



  const _ao_fence_core_api_ = {
    ao_check_done

  , // copyable fence fork api
    [Symbol.asyncIterator]() {
      return this.ao_fork()}

  , ao_fork() {
      let ag = ao_iter_fence(this.fence);
      let {xemit} = this;
      return xemit ? xemit(ag) : ag} };


  function ao_fence_fn(tgt) {
    let f = ao_fence_v();
    if (undefined === tgt) {tgt = f[0];}
    tgt.fence = Object.assign(tgt, _ao_fence_core_api_);
    return f}


  const ao_fence_obj = () =>
    ao_fence_o(_ao_fence_core_api_);

  function ao_split(iterable) {
    let f_out = ao_fence_obj();
    f_out.when_run = _ao_run(iterable, f_out);
    f_out.g_in = iterable.g_in;
    return f_out}

  async function _ao_run(iterable, f_tap) {
    try {
      for await (let v of iterable) {
        f_tap.resume(v);} }

    catch (err) {
      ao_check_done(err);}

    finally {
      f_tap.abort();} }


  function ao_tap(iterable) {
    let f_tap = ao_fence_obj();
    let ag_tap = _ao_tap(iterable, f_tap);
    ag_tap.f_tap = ag_tap.f_out = f_tap;
    ag_tap.g_in = f_tap.g_in = iterable.g_in;
    return [f_tap, ag_tap]}

  async function * _ao_tap(iterable, f_tap) {
    try {
      for await (let v of iterable) {
        f_tap.resume(v);
        yield v;} }

    catch (err) {
      ao_check_done(err);}

    finally {
      f_tap.abort();} }

  function ao_track(proto, reset_v) {
    let r = ao_track_v(reset_v);
    return {__proto__: proto,
      tip: () => r[0] // or fence(false)
    , resume: r[1]
    , abort: r[2]
    , fence: r[3]
    , ftr: () => r[4] } }// or fence(true)

  function ao_track_v(reset_v = ()=>ao_defer_v()) {
    // like ao_defer_v() and resetable like ao_fence_v()
    let r; // r is the current / tracked value defined below
    let x=reset_v(); // x is the future/deferred

    let p; // p is the rachet memory for the fence() closure
    // similar to fence.fence() while also tracking the last completed deferred
    let fence = ftr =>(
      false===ftr ? r[0] : true===ftr ? x[0] : // non-racheting queries
      p===x[0] || p===r[0] ? p=x[0] : p=r[0] );// racheting query

    // like fence.resume, resolves the future/deferred x[0]; then resets x future/deferred
    let resume = ans => xz(x[1], ans);

    // like fence.abort, rejects the future/deferred x[0]; then resets x future/deferred
    let abort  = err => xz(x[2], err || ao_done);

    // match ao_defer_v() of [current promise, resolve, reject] with additional [fence, ftr promise]
    return r = [ p=x[0], resume, abort, fence, x[0] ]

    function xz(xf, v) {
      // 1. update current / tip slot: r[0] = x[0]
      // 2. re-prime fence: x = reset_v(r[0]]
      x = reset_v(r[0] = x[0]);
      r[4] = x[0]; // update public ftr slot
      xf(v); } }// resume/abort r[0] current / tip


  const ao_track_when = db =>
    ao_when_map(ao_track_v, db);

  const ao_fence_out = /* #__PURE__ */ ao_fence_o.bind(null,{
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

  , ao_gated(f_gate) {
      return this.bind_gated(f_gate).ao_bound()}

  , _ao_gated(f_gate) {return aog_gated(this, f_gate)} } );


  async function * aog_gated(f_out, f_gate) {
    try {
      f_out.resume();
      while (1) {
        let v = await f_gate.fence();
        yield v;
        f_out.resume(v);} }
    catch (err) {
      ao_check_done(err);}
    finally {
      f_out.abort();
      if (f_gate.abort) {
        f_gate.abort();} } }


  function aog_fence_xf(xinit, ...args) {
    let f_in = ao_fence_o(), f_out = ao_fence_o();
    let g_in = xinit(f_in, f_out, ...args);
    g_in.next();

    let res = aog_gated(f_out, f_in);
    res.fence = f_out.fence;
    res.g_in = g_in;
    return res}

  function ao_fence_iter(...args) {
    return aog_fence_xf(aog_iter, ...args)}

  function ao_fence_sink(...args) {
    return aog_fence_xf(aog_sink, ...args)}


  function * aog_iter(f_in, f_gate, xf) {
    try {
      while (1) {
        let tip = yield;
        if (undefined !== xf) {
          tip = (xf.next(tip)).value;}
        f_in.resume(tip);} }

    catch (err) {
      ao_check_done(err);}
    finally {
      f_in.abort();
      if (undefined !== xf) {
        xf.return();} } }


  async function * aog_sink(f_in, f_gate, xf) {
    try {
      while (1) {
         {
          let tip = yield;
          if (undefined !== xf) {
            tip = (await xf.next(tip)).value;}
          f_in.resume(tip);}

        if (undefined !== f_gate) {
          await f_gate.fence();} } }

    catch (err) {
      ao_check_done(err);}
    finally {
      f_in.abort();
      if (undefined !== xf) {
        xf.return();} } }
  const ao_queue = ns_gen => ao_fence_in().ao_queue(ns_gen);

  const ao_fence_in = /* #__PURE__ */ ao_fence_o.bind(null,{
    __proto__: _ao_fence_core_api_

  , ao_fold(ns_gen) {return this.ao_xform({xinit: aog_iter, ... ns_gen})}
  , ao_queue(ns_gen) {return this.ao_xform({xinit: aog_sink, ... ns_gen})}

  , aog_iter(xf) {return aog_iter(this)}
  , aog_sink(f_gate, xf) {return aog_sink(this, f_gate, xf)}

  , ao_xform(ns_gen={}) {
      let f_out = ao_fence_out();

      let {xemit, xinit, xrecv} =
        is_ao_fn(ns_gen)
          ? ns_gen(this, f_out)
          : ns_gen;

      if (undefined !== xemit) {
        f_out.xemit = xemit;}

      if (! xinit) {xinit = aog_sink;}
      let res = xinit(this, f_out,
        xrecv ? _xf_gen.create(xrecv) : undefined);

      let g_in = f_out.g_in = res.g_in || res;
      return res !== g_in
        ? res // res is an output generator
        :(// res is an input generator
            g_in.next(),
            f_out.bind_gated(this)) }

  , // ES2015 generator api
    next(v) {return {value: this.resume(v), done: true}}
  , return() {return {value: this.abort(ao_done), done: true}}
  , throw(err) {return {value: this.abort(err), done: true}} } );


  const _xf_gen = {
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

  function ao_push_stream(as_vec) {
    let q=[], [fence, resume, abort] = ao_fence_v();
    let stream = ao_stream_fence(fence);

    return Object.assign(stream,{
      stream
    , abort
    , push(... args) {
        if (true === as_vec) {
          q.push(args);}
        else q.push(... args);

        resume(q);
        return q.length} } ) }


  function ao_stream_fence(fence) {
    let [when_done, res_done, rej_done] = ao_defer_v();
    let res = _ao_stream_fence(fence, res_done, rej_done);
    res.when_done = when_done;
    return res}


  async function * _ao_stream_fence(fence, resolve, reject) {
    try {
      let p_ready = fence();
      while (1) {
        let batch = await p_ready;
        batch = batch.splice(0, batch.length);

        p_ready = fence();
        yield * batch;} }

    catch (err) {
      if (!err || err.ao_done) {
        resolve(true);}
      else reject(err);} }

  function ao_interval(ms=1000) {
    let [_fence, _resume, _abort] = ao_fence_fn();
    let tid = setInterval(_resume, ms, 1);
    if (tid.unref) {tid.unref();}
    _fence.stop = (() => {
      tid = clearInterval(tid);
      _abort();});

    return _fence}


  function ao_timeout(ms=1000) {
    let tid, [_fence, _resume, _abort] = ao_fence_fn(timeout);
    timeout.stop = (() => {
      tid = clearTimeout(tid);
      _abort();});
    return timeout

    function timeout(ms_next=ms) {
      tid = setTimeout(_resume, ms_next, 1);
      if (tid.unref) {tid.unref();}
      return _fence()} }


  function ao_debounce(ms=300, ao_iterable) {
    let tid, [_fence, _resume] = ao_fence_fn();

    _fence.when_run = ((async () => {
      try {
        let p;
        for await (let v of ao_iterable) {
          clearTimeout(tid);
          p = _fence();
          tid = setTimeout(_resume, ms, v);
          if (tid.unref) {tid.unref();} }

        await p;}
      catch (err) {
        ao_check_done(err);} })());

    return _fence}


  async function * ao_times(ao_iterable) {
    let ts0 = Date.now();
    for await (let v of ao_iterable) {
      yield [Date.now() - ts0, v];} }

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

  describe('smoke', (() => {
    it('defer', (() => {
      is_fn(ao_defer_o);
      is_fn(ao_defer_v); }) );

    it('fence', (() => {
      is_fn(ao_fence_v);
      is_fn(ao_fence_fn);
      is_fn(ao_fence_obj);
      is_fn(ao_fence_in); }) );

    it('drive', (() => {
      is_fn(iter);
      is_fn(step_iter);
      is_fn(ao_iter);
      is_fn(ao_step_iter);

      is_fn(ao_run);
      is_fn(ao_drive); }) );

    it('split', (() => {
      is_fn(ao_split);
      is_fn(ao_tap); }) ); }) );

  describe('core ao_defer_o', (() => {

    describe('ao_defer_v tuple', (() => {
      it('shape', (() => {
        const res = ao_defer_v();
        expect(res).to.be.an('array').of.length(3);
        expect(res[0]).to.be.a('promise');
        expect(res[1]).to.be.a('function');
        expect(res[2]).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const [p, resolve, reject] = ao_defer_v();

        assert.equal('timeout', await delay_race(p,1));

        resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const [p, resolve, reject] = ao_defer_v();

        assert.equal('timeout', await delay_race(p,1));

        reject(new Error('nope'));

        try {
          await p;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); } }) ); }) );



    describe('ao_defer_o object', (() => {
      it('shape', (() => {
        const res = ao_defer_o();
        expect(res).to.be.an('object');
        expect(res.promise).to.be.a('promise');
        expect(res.resolve).to.be.a('function');
        expect(res.reject).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const res = ao_defer_o();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const res = ao_defer_o();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.reject(new Error('nope'));

        try {
          await p;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); } }) ); }) ); }) );

  describe('core drive', (() => {

    it('ao_run', (async () => {
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_run(g);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined); }) );

    it('ao_drive generator', (async () => {
      let lst = [];
      let g_tgt = gen_test(lst);
      g_tgt.next('first');
      g_tgt.next('second');
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, g_tgt);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);
      g_tgt.next('final');

      assert.deepEqual(lst,[
        'second'
      , 1942
      , 2042
      , 2142
      , 'final'] );

      function * gen_test(lst) {
        while (1) {
          let v = yield;
          lst.push(v);} } }) );

    it('ao_drive function', (async () => {
      let lst = [];
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, gen_test);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);

      assert.deepEqual(lst,[
        1942
      , 2042
      , 2142] );

      function * gen_test() {
        while (1) {
          let v = yield;
          lst.push(v);} } }) ); }) );

  describe('core drive iters', (() => {

    it('normal iter', (() => {
      let g = is_gen(iter([10, 20, 30]));
      assert.deepEqual({value: 10, done: false}, g.next()); }) );


    it('async iter', (async () => {
      let g = is_gen(ao_iter([10, 20, 30]));

      let p = g.next();
      expect(p).to.be.a('promise');

      assert.deepEqual({value: 10, done: false}, await p); }) );


    it('normal step_iter', (() => {
      let z = Array.from(
        zip(
          [10, 20, 30]
        , ['a', 'b', 'c']) );

      assert.deepEqual(z,[
        [10, 'a']
      , [20, 'b']
      , [30, 'c']] );

      function * zip(a, b) {
        b = step_iter(b);
        for (let av of iter(a)) {
          for (let bv of b) {
            yield [av, bv];} } } }) );


    it('async ao_step_iter', (async () => {
      let z = await array_from_ao_iter(
        ao_zip(
          [10, 20, 30]
        , ['a', 'b', 'c']) );

      assert.deepEqual(z,[
        [10, 'a']
      , [20, 'b']
      , [30, 'c']] );


      async function * ao_zip(a, b) {
        b = ao_step_iter(b);
        for await (let av of ao_iter(a)) {
          for await (let bv of b) {
            yield [av, bv];} } } }) ); }) );

  describe('core split', (() => {

    it('ao_split triple', (async () => {
        let g = delay_walk([1942, 2042, 2142]);

        let gs = is_async_iterable(ao_split(g));

        expect(gs.when_run).to.be.a('promise');
        expect(gs.fence).to.be.a('function');

        let p = gs.fence();
        expect(p).to.be.a('promise');

        let a = array_from_ao_iter(gs);
        expect(a).to.be.a('promise');
        let b = array_from_ao_iter(gs);
        expect(b).to.be.a('promise');
        let c = array_from_ao_iter(gs.ao_fork());
        expect(c).to.be.a('promise');

        assert.equal(await p, 1942);

        p = gs.fence();
        assert.equal(await p, 2042);

        p = gs.fence();
        assert.equal(await p, 2142);

        await gs.when_run;
        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) );


    it('ao_tap triple', (async () => {
        let g = delay_walk([1942, 2042, 2142]);
        let [f_out, ag_tap] = ao_tap(g);
        is_async_iterable(f_out);
        is_gen(ag_tap);

        expect(f_out.fence).to.be.a('function');

        let p = f_out.fence();
        expect(p).to.be.a('promise');

        let a = array_from_ao_iter(f_out.ao_fork());
        expect(a).to.be.a('promise');
        let b = array_from_ao_iter(f_out);
        expect(b).to.be.a('promise');
        let c = array_from_ao_iter(f_out.ao_fork());
        expect(c).to.be.a('promise');

        assert.equal('timeout', await delay_race(p,1));
        array_from_ao_iter(ag_tap);

        assert.equal(await p, 1942);

        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) ); }) );

  describe('ao_track', (() => {

    describe('ao_track_v tuple', (() => {
      it('shape', (() => {
        const res = ao_track_v();
        expect(res).to.be.an('array');
        expect(res).to.have.length(5);
        expect(res[0]).to.be.a('promise');
        expect(res[1]).to.be.a('function');
        expect(res[2]).to.be.a('function');
        expect(res[3]).to.be.a('function');
        expect(res[4]).to.be.a('promise');

        // future and current start out the same
        expect(res[0]).to.equal(res[4]);}) );

      it('track fence()', (async () => {
        const vt = ao_track_v();
        const [ptip, resume, abort, fence] = vt;

        // until first resume, fence and tip are the same
        let pf0 = fence();
        expect(pf0).to.equal(ptip);
        let pf1 = fence();
        expect(pf1).to.equal(pf0);
        expect(fence(true)).to.equal(pf1);

        expect(vt[0]).to.equal(ptip);
        expect(fence(false)).to.equal(vt[0]);
        resume(42); // rachet first resolved promise forward
        expect(fence(false)).to.equal(vt[0]);
        expect(vt[0]).to.equal(ptip);

        let pf2 = fence();
        expect(pf2).to.not.equal(pf1);
        let pf3 = fence();
        expect(pf3).to.equal(pf2);

        expect(vt[0]).to.equal(ptip);
        expect(fence(true)).to.equal(pf3);
        expect(fence(false)).to.equal(vt[0]);
        resume(1942); // rachet first resolved promise forward
        expect(fence(false)).to.equal(vt[0]);
        expect(vt[0]).to.not.equal(ptip);
        expect(vt[0]).to.equal(pf3);
        expect(fence(true)).to.not.equal(pf3);

        let pf4 = fence();
        expect(pf4).to.not.equal(vt[0]);
        expect(pf4).to.not.equal(pf3);

        expect(fence(true)).to.equal(pf4);
        expect(fence(false)).to.equal(vt[0]);

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(42);
        expect(await pf1).to.equal(42);
        expect(await pf2).to.equal(1942);
        expect(await pf3).to.equal(1942);}) );


      it('use, resume with fence()', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        resume(42); // create difference for tip and fence

        let pf0 = fence(); // first use of fence, should be same as ptip
        expect(pf0).to.be.a('promise');
        expect(pf0).to.not.equal(ptip);

        let pf1 = fence(); // second use of fence, should be different from ptip
        expect(pf1).to.be.a('promise');
        expect(pf1).to.equal(pf0);

        resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(1942);
        expect(await pf1).to.equal(1942);}) );

      it('use, abort with fence()', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        expect(fence(false)).to.equal(ptip);

        abort(new Error('nope')); // create difference for tip and fence
        expect(fence(false)).to.equal(ptip);

        let pf0 = fence();
        expect(pf0).to.be.a('promise');
        expect(fence(false)).to.equal(ptip);
        expect(fence(true)).to.equal(pf0);

        let pf1 = fence();
        expect(pf1).to.be.a('promise');
        expect(pf1).to.equal(pf0);
        expect(fence(false)).to.equal(ptip);
        expect(fence(true)).to.equal(pf1);

        abort(new Error('not, again')); // create difference for tip and fence
        expect(fence(false)).to.equal(pf1);
        expect(fence(true)).to.not.equal(pf0);

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message ); }// await ptip

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message ); }// await pf0

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message ); } }) ); }) );// await pf1


    describe('ao_track object', (() => {
      it('shape', (() => {
        const res = ao_track();
        expect(res).to.be.an('object');
        expect(res.tip).to.be.a('function');
        expect(res.resume).to.be.a('function');
        expect(res.abort).to.be.a('function');
        expect(res.fence).to.be.a('function');
        expect(res.ftr).to.be.a('function');

        expect(res.tip()).to.be.a('promise');
        expect(res.ftr()).to.be.a('promise');
        // future and current start out the same
        expect(res.tip()).to.equal(res.ftr());}) );

      it('use, resume with fence()', (async () => {
        const res = ao_track(), ptip = res.tip();
        res.resume(42); // create difference for tip and fence

        let pf0 = res.fence(); // first use of fence, should be same as ptip
        expect(pf0).to.be.a('promise');
        expect(pf0).to.not.equal(ptip);

        let pf1 = res.fence(); // second use of fence, should be different from ptip
        expect(pf1).to.be.a('promise');
        expect(pf1).to.equal(pf0);

        res.resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(1942);
        expect(await pf1).to.equal(1942);}) );

      it('use, abort with fence()', (async () => {
        const res = ao_track(), ptip = res.tip();
        expect(res.fence(false)).to.equal(ptip);

        res.abort(new Error('nope')); // create difference for tip and fence
        expect(res.fence(false)).to.equal(ptip);

        let pf0 = res.fence();
        expect(pf0).to.be.a('promise');
        expect(res.fence(false)).to.equal(ptip);
        expect(res.fence(true)).to.equal(pf0);

        let pf1 = res.fence();
        expect(pf1).to.be.a('promise');
        expect(pf1).to.equal(pf0);
        expect(res.fence(false)).to.equal(ptip);
        expect(res.fence(true)).to.equal(pf1);

        res.abort(new Error('not, again')); // create difference for tip and fence
        expect(res.fence(false)).to.equal(pf1);
        expect(res.fence(true)).to.not.equal(pf0);

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message ); }// await ptip

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message ); }// await pf0

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message ); } }) ); }) ); }) );// await pf1

  describe('ao_fence_v tuple', function() {
    it('shape', (() => {
      const res = ao_fence_v();
      expect(res).to.be.an('array').of.length(3);
      expect(res[0]).to.be.a('function');
      expect(res[1]).to.be.a('function');
      expect(res[2]).to.be.a('function');}) );


    it('basic use', (async () => {
      const [fence, resume] = ao_fence_v();

      const p = fence();
      assert.equal('timeout', await delay_race(p,1));

      resume(1942);
      assert.equal(1942, await delay_race(p,1)); }) );


    it('only first after', (async () => {
      const [fence, resume] = ao_fence_v();
      let f;

      resume('one');
      f = fence();
      resume('two');
      resume('three');

      assert.equal('two', await f);

      resume('four');
      resume('five');
      f = fence();
      resume('six');
      resume('seven');

      assert.equal('six', await f); }) );


    it('never blocked on fence', (async () => {
      const [fence, resume] = ao_fence_v();

      resume('one');
      resume('two');
      resume('three'); }) );


    it('exercise fence', (async () => {
      const [fence, resume] = ao_fence_v();

      let v = 'a';
      expect(v).to.equal('a');

      const p = ((async () => {
        v = 'b';

         {const ans = await fence();
           expect(ans).to.equal('bb');}

        v = 'c';
         {const ans = await fence();
           expect(ans).to.equal('cc');}
        v = 'd';
        return 1942})());

      assert.equal('timeout', await delay_race(p,1));
      expect(v).to.equal('b');

       {
        const p = resume(v+v);
        expect(p).to.be.undefined;}

      expect(v).to.equal('b');
      assert.equal('timeout', await delay_race(p,1));
      expect(v).to.equal('c');

       {
        const p = resume(v+v);
        expect(p).to.be.undefined;}

      expect(v).to.equal('c');
      assert.equal(1942, await delay_race(p,1));
      expect(v).to.equal('d');}) ); } );

  describe('ao_fence_fn', function() {
    it('shape', (() => {
      const res = ao_fence_fn();

      expect(res).to.be.an('array').of.length(3);
      expect(res[0]).to.be.a('function');
      expect(res[1]).to.be.a('function');
      expect(res[2]).to.be.a('function');

      is_fence_core(res[0]);}) );


    it('basic use', (async () => {
      const [fence, resume] = ao_fence_fn();

      const p = fence();
      assert.equal('timeout', await delay_race(p,1));

      resume(1942);
      assert.equal(1942, await delay_race(p,1)); }) );


    it('async iter use', (async () => {
      const [fence, resume] = ao_fence_fn();

      delay().then (() =>resume('ready'));

      for await (let v of fence) {
        assert.equal('ready', v);
        break} }) );


    it('async iter multi use', (async () => {
      const [fence, resume] = ao_fence_fn();

      let pa = ((async () => {
        for await (let v of fence) {
          return `pa ${v}`} })());

      let pb = ((async () => {
        for await (let v of fence.ao_fork()) {
          return `pb ${v}`} })());

      let pc = fence();

      assert.equal('timeout', await delay_race(pa,1));
      assert.equal('timeout', await delay_race(pb,1));
      assert.equal('timeout', await delay_race(pc,1));

      resume('ready');
      assert.equal('pa ready', await delay_race(pa,1));
      assert.equal('pb ready', await delay_race(pb,1));
      assert.equal('ready', await delay_race(pc,1)); }) ); } );

  describe('ao_fence_obj', function() {
    it('shape', (() => {
      let res = ao_fence_obj();
      expect(res.fence).to.be.a('function');
      expect(res.resume).to.be.a('function');
      expect(res.abort).to.be.a('function');

      is_fence_core(res); }) );

    it('basic use', (async () => {
      const res = ao_fence_obj();

      const p = res.fence();
      assert.equal('timeout', await delay_race(p,1));

      res.resume(1942);
      assert.equal(1942, await delay_race(p,1)); }) );


    it('async iter use', (async () => {
      const res = ao_fence_obj();

      delay().then (() =>res.resume('ready'));

      for await (let v of res) {
        assert.equal('ready', v);
        break} }) );


    it('async iter multi use', (async () => {
      const res = ao_fence_obj();

      let pa = ((async () => {
        for await (let v of res) {
          return `pa ${v}`} })());

      let pb = ((async () => {
        for await (let v of res.ao_fork()) {
          return `pb ${v}`} })());

      let pc = res.fence();

      assert.equal('timeout', await delay_race(pa,1));
      assert.equal('timeout', await delay_race(pb,1));
      assert.equal('timeout', await delay_race(pc,1));

      res.resume('ready');
      assert.equal('pa ready', await delay_race(pa,1));
      assert.equal('pb ready', await delay_race(pb,1));
      assert.equal('ready', await delay_race(pc,1)); }) ); } );

  describe('core ao_when and ao_defer_when', (() => {

    it('shape', (() => {
      expect(ao_defer_when).to.equal(ao_defer_when);

      const res = ao_defer_when();
      expect(res).to.be.an('object');
      expect(res.has).to.be.a('function');
      expect(res.get).to.be.a('function');
      expect(res.set).to.be.a('function');
      expect(res.delete).to.be.a('function');
      expect(res.define).to.be.a('function');}) );

    it('when map-like with deferred promises', (async () => {
      const res = ao_defer_when();
      let p_get = res.get('some-key');
      expect(p_get).to.be.a('promise');

      let p_set = res.set('some-key', 'some-value');
      expect(p_set).to.be.a('promise');

      // expect same value
      expect(p_set).to.equal(p_get);

      expect(await p_get).to.equal('some-value');}) );

    it('when defered multiple set', (async () => {
      const res = ao_defer_when();
      let p_get = res.get('some-key');
      let p_set = res.set('some-key', 'first-value');
      expect(await p_get).to.equal('first-value');

      res.set('some-key', 'another-value');

      // expect first value
      expect(await p_set).to.equal('first-value');

      // expect first value
      expect(await res.get('some-key')).to.equal('first-value');}) ); }) );

  describe('ao_track_when', (() => {

    it('shape', (() => {
      const res = ao_track_when();
      expect(res).to.be.an('object');
      expect(res.has).to.be.a('function');
      expect(res.get).to.be.a('function');
      expect(res.set).to.be.a('function');
      expect(res.delete).to.be.a('function');
      expect(res.define).to.be.a('function');}) );

    it('when map-like with fences', (async () => {
      const res = ao_track_when();

      let p_get = res.get('some-key');
      expect(p_get).to.be.a('promise');

      let p_set = res.set('some-key', 'some-value');
      expect(p_set).to.be.a('promise');

      // expect same value
      expect(p_set).to.equal(p_get);

      expect(await p_get).to.equal('some-value');}) );


    it('when track changed', (async () => {
      const res = ao_track_when();

      let p_get = res.get('some-key');
      res.set('some-key', 'first-value');
      expect(await p_get).to.equal('first-value');

      let p_get_pre = res.get('some-key');
      res.set('some-key', 'another-value');
      let p_get_post = res.get('some-key');

      expect(await p_get).to.equal('first-value');
      expect(await p_get_pre).to.equal('first-value');
      expect(await p_get_post).to.equal('another-value');}) ); }) );

  describe('ao_fence_when', (() => {

    it('shape', (() => {
      const res = ao_fence_when();
      expect(res).to.be.an('object');
      expect(res.has).to.be.a('function');
      expect(res.get).to.be.a('function');
      expect(res.set).to.be.a('function');
      expect(res.delete).to.be.a('function');
      expect(res.define).to.be.a('function');}) );

    it('when map-like with fences', (async () => {
      const res = ao_fence_when();
      let fn_get = res.get('some-key');
      expect(fn_get).to.be.a('function');

      let p_get = fn_get();
      expect(p_get).to.be.a('promise');

      let fn_set = res.set('some-key', 'some-value');
      expect(fn_set).to.be.a('function');

      // expect same value
      expect(fn_set).to.equal(fn_get);

      expect(await p_get).to.equal('some-value');}) );


    it('when fence reset', (async () => {
      const res = ao_fence_when();

      let fn_get = res.get('some-key');

      let p_get = fn_get();
      res.set('some-key', 'first-value');
      expect(await p_get).to.equal('first-value');

      let p_get_2 = fn_get(); // reset
      res.set('some-key', 'another-value');

      expect(await p_get).to.equal('first-value');
      expect(await p_get_2).to.equal('another-value');}) ); }) );

  describe('ao_fence_out', function() {
    it('shape', (() => {
      const res = is_fence_core(ao_fence_out());
      expect(res.ao_bound).to.be.a('function');
      expect(res.ao_run).to.be.a('function');
      expect(res.bind_gated).to.be.a('function');
      expect(res.allow_many).to.be.a('function');}) );


    it('check not bound error', (async () => {
      const f = ao_fence_out();

      try {
        await delay_race(ao_iter(f).next());
        assert.fail('should have returned an error'); }
      catch (err) {
        if (/ao_fence_out not bound/.test(err.message)) ;// worked
        else throw err} }) );


    it('check already bound error', (async () => {
      const f_gate = ao_fence_obj();
      const f = ao_fence_out().bind_gated(f_gate);

      try {
        await delay_race(ao_iter(f).next());
        await delay_race(ao_iter(f).next());
        assert.fail('should have returned an error'); }
      catch (err) {
        if (/ao_fence_out consumed;/.test(err.message)) ;// worked
        else throw err} }) );

    it('allow_many()', (async () => {
      const f_gate = ao_fence_obj();
      const f = ao_fence_out().bind_gated(f_gate);
      f.allow_many();

      await delay_race(ao_iter(f).next());
      await delay_race(ao_iter(f).next());
      await delay_race(ao_iter(f).next()); }) );

    it('ao_fork()', (async () => {
      const f_gate = ao_fence_obj();
      const f = ao_fence_out().bind_gated(f_gate);
      f.allow_many();

      await delay_race(ao_iter(f.ao_fork()).next());
      await delay_race(ao_iter(f).next());
      await delay_race(ao_iter(f.ao_fork()).next()); }) );

    it('ao_bound()', (async () => {
      const f_gate = ao_fence_obj();
      const f = ao_fence_out().bind_gated(f_gate);
      f.allow_many();

      await delay_race(ao_iter(f.ao_fork()).next());
      await delay_race(ao_iter(f.ao_bound()).next());
      await delay_race(ao_iter(f.ao_fork()).next()); }) );

    it('ao_run()', (async () => {
      const f_gate = ao_fence_obj();
      const f = ao_fence_out().bind_gated(f_gate);
      f.allow_many();

      await delay_race(ao_iter(f.ao_fork()).next());
      let p = f.ao_run();
      await delay_race(ao_iter(f.ao_fork()).next());

      expect(p).to.be.a('promise');
      expect(f.when_run).to.equal(p);}) ); } );

  describe('ao_fence_in', (() => {
    it('shape', (() => {
      const res = is_fence_gen(ao_fence_in());
      expect(res.ao_xform).to.be.a('function');
      expect(res.ao_fold).to.be.a('function');
      expect(res.ao_queue).to.be.a('function');
      expect(res.aog_iter).to.be.a('function');
      expect(res.aog_sink).to.be.a('function');}) );


    it('basic use', (async () => {
      const res = ao_fence_in();

      const p = res.fence();
      assert.equal('timeout', await delay_race(p,1));

      res.resume(1942);
      assert.equal(1942, await delay_race(p,1)); }) );


    it('async iter use', (async () => {
      const res = ao_fence_in();

      delay().then (() =>res.resume('ready'));

      for await (let v of res) {
        assert.equal('ready', v);
        break} }) );


    it('async iter multi use', (async () => {
      const res = ao_fence_in();

      let pa = ((async () => {
        for await (let v of res) {
          return `pa ${v}`} })());

      let pb = ((async () => {
        for await (let v of res.ao_fork()) {
          return `pb ${v}`} })());

      let pc = res.fence();

      assert.equal('timeout', await delay_race(pa,1));
      assert.equal('timeout', await delay_race(pb,1));
      assert.equal('timeout', await delay_race(pc,1));

      res.resume('ready');
      assert.equal('pa ready', await delay_race(pa,1));
      assert.equal('pb ready', await delay_race(pb,1));
      assert.equal('ready', await delay_race(pc,1)); }) ); }) );

  describe('ao_fence_in().ao_xform()', function() {
    it('shape', (() => {
      let some_pipe = is_async_iterable(
        ao_fence_in().ao_xform());

      is_gen(some_pipe.g_in);
      expect(some_pipe.fence).to.be.a('function');}) );

    it('simple', (async () => {
      let some_pipe = ao_fence_in().ao_xform();
      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 2042, 2142]
      , await delay_race(z, 50)); }) );


    it('xrecv sum pre transform', (async () => {
      let some_pipe = ao_fence_in().ao_xform({
        *xrecv(g) {
          let s = 0;
          for (let v of g) {
            s += v;
            yield s;} } });

      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 1942+2042, 1942+2042+2142]
      , await delay_race(z, 50)); }) );


    it('xemit post transform', (async () => {
      let some_pipe = ao_fence_in().ao_xform({
        async * xemit(g) {
          for await (let v of g) {
            yield ['xe', v];} } });

      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [['xe', 1942]
          , ['xe', 2042]
          , ['xe', 2142]]
      , await delay_race(z, 50)); }) );


    it('xinit context g_in', (async () => {
      let log=[];

      let some_pipe = ao_fence_in().ao_xform({
        *xinit(g_in) {
          log.push('xctx start');
          let tid = setTimeout(
            v => g_in.next(v)
          , 1, 'bingo');

          try {
            yield * g_in.aog_iter();}
          finally {
            clearTimeout(tid);
            log.push('xctx fin'); } } });

      let z = array_from_ao_iter(some_pipe);

      assert.deepEqual(log,['xctx start']);

      await delay(5);
      some_pipe.g_in.return();

      assert.deepEqual(log,['xctx start', 'xctx fin']);

      assert.deepEqual(await z,['bingo']); }) );


    async function _test_pipe_out(some_pipe, values) {
      let z = array_from_ao_iter(some_pipe);

      await ao_drive(
        delay_walk(values)
      , some_pipe.g_in, true);

      return z} } );

  describe('ao_fence_in().ao_fold()', function() {
    it('shape', (() => {
      let some_pipe = is_async_iterable(
        ao_fence_in().ao_fold());

      is_gen(some_pipe.g_in);
      expect(some_pipe.fence).to.be.a('function');}) );

    it('simple', (async () => {
      let some_pipe = ao_fence_in().ao_fold();
      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 2042, 2142]
      , await delay_race(z, 50)); }) );


    it('xrecv sum pre transform', (async () => {
      let some_pipe = ao_fence_in().ao_fold({
        *xrecv(g) {
          let s = 0;
          for (let v of g) {
            s += v;
            yield s;} } });

      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 1942+2042, 1942+2042+2142]
      , await delay_race(z, 50)); }) );


    it('xemit post transform', (async () => {
      let some_pipe = ao_fence_in().ao_fold({
        async * xemit(g) {
          for await (let v of g) {
            yield ['xe', v];} } });

      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [['xe', 1942]
          , ['xe', 2042]
          , ['xe', 2142]]
      , await delay_race(z, 50)); }) );


    it('xinit context g_in', (async () => {
      let log=[];

      let some_pipe = ao_fence_in().ao_fold({
        *xinit(g_in) {
          log.push('xctx start');
          let tid = setTimeout(
            v => g_in.next(v)
          , 1, 'bingo');

          try {
            yield * g_in.aog_iter();}
          finally {
            clearTimeout(tid);
            log.push('xctx fin'); } } });

      let z = array_from_ao_iter(some_pipe);

      assert.deepEqual(log,['xctx start']);

      await delay(5);
      some_pipe.g_in.return();

      assert.deepEqual(log,['xctx start', 'xctx fin']);

      assert.deepEqual(await z,['bingo']); }) );


    async function _test_pipe_out(some_pipe, values) {
      let z = array_from_ao_iter(some_pipe);

      await ao_drive(
        delay_walk(values)
      , some_pipe.g_in, true);

      return z} } );

  describe('ao_fence_in().ao_queue()', function() {
    it('shape', (() => {
      let some_queue = is_async_iterable(
        ao_fence_in().ao_queue());

      is_gen(some_queue.g_in);
      expect(some_queue.fence).to.be.a('function');}) );

    it('singles', (async () => {
      let some_queue = ao_fence_in().ao_queue();

      let p_out1 = ao_iter(some_queue).next();
      expect(p_out1).to.be.a('promise');

      let p_in1 = some_queue.g_in.next('first');
      expect(p_in1).to.be.a('promise');

      expect(await p_out1).to.deep.equal({
        value: 'first', done: false}); }) );

    it('vec', (async () => {
      let some_queue = ao_fence_in().ao_queue({
        async * xrecv(g) {
          for await (let v of g) {
            yield 1000+v;} } });

      let out = array_from_ao_iter(some_queue);

      await ao_drive(
        delay_walk([25, 50, 75, 100])
      , some_queue.g_in);

      await some_queue.g_in.return();

      expect(await out).to.deep.equal([
        1025, 1050, 1075, 1100]); }) ); } );

  describe('fence_bare', function() {

    describe('ao_fence_sink()', function() {
      it('shape', (() => {
        let some_queue = is_async_iterable(
          ao_fence_sink());

        is_gen(some_queue.g_in);
        expect(some_queue.fence).to.be.a('function');}) );

      it('singles', (async () => {
        let some_queue = ao_fence_sink();

        let p_out1 = ao_iter(some_queue).next();
        expect(p_out1).to.be.a('promise');

        let p_in1 = some_queue.g_in.next('first');
        expect(p_in1).to.be.a('promise');

        expect(await p_out1).to.deep.equal({
          value: 'first', done: false}); }) );

      it('vec', (async () => {
        let first_queue = ao_fence_sink();
        let second_queue = ((async function *(){
          for await (let v of first_queue) {
            yield 1000+v;} }).call(this));

        let out = array_from_ao_iter(second_queue);

        await ao_drive(
          delay_walk([25, 50, 75, 100])
        , first_queue.g_in);

        await first_queue.g_in.return();

        expect(await out).to.deep.equal([
          1025, 1050, 1075, 1100]); }) ); } );


    describe('ao_fence_iter()', function() {
      it('shape', (() => {
        let some_pipe = is_async_iterable(
          ao_fence_iter());

        is_gen(some_pipe.g_in);
        expect(some_pipe.fence).to.be.a('function');}) );

      it('simple', (async () => {
        let some_pipe = ao_fence_iter();
        let z = _test_pipe_out(some_pipe,
          [1942, 2042, 2142]);

        assert.deepEqual(
          [1942, 2042, 2142]
        , await delay_race(z, 50)); }) );


      it('xemit post transform', (async () => {
        let first_pipe = ao_fence_iter();
        let second_pipe = ((async function *(){
          for await (let v of first_pipe) {
            yield ['xe', v];} }).call(this));

        second_pipe.g_in = first_pipe.g_in;

        let z = _test_pipe_out(second_pipe,
          [1942, 2042, 2142]);

        assert.deepEqual(
          [['xe', 1942]
            , ['xe', 2042]
            , ['xe', 2142]]
        , await delay_race(z, 50)); }) );


      async function _test_pipe_out(some_pipe, values) {
        let z = array_from_ao_iter(some_pipe);

        await ao_drive(
          delay_walk(values)
        , some_pipe.g_in, true);

        return z} } ); } );

  describe('fence_stream', function() {

    describe('ao_push_stream()', function() {
      it('shape', (() => {
        let some_stream = is_async_iterable(
          ao_push_stream());

        expect(some_stream.g_in).to.be.undefined;}) );

      it('singles', (async () => {
        let some_stream = ao_push_stream();

        let p_out1 = ao_iter(some_stream).next();
        expect(p_out1).to.be.a('promise');

        some_stream.push('first');
        expect(await p_out1).to.deep.equal({
          value: 'first', done: false}); }) );


      it('vec', (async () => {
        let first_stream = ao_push_stream();

        let second_stream = ((async function *(){
          for await (let v of first_stream) {
            yield 1000+v;} }).call(this));

        let out = array_from_ao_iter(second_stream);

        for await (let v of delay_walk([25, 50, 75, 100]) ) {
          first_stream.push(v);}

        first_stream.abort();

        expect(await out).to.deep.equal([
          1025, 1050, 1075, 1100]); }) ); } ); } );

  describe('time', (() => {
    it('shape', (() => {
      is_fn(ao_interval);
      is_fn(ao_timeout);
      is_fn(ao_times); }) );


    it('ao_interval', (async () => {
      let aot = is_async_iterable(
        ao_interval(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );


    it('ao_timeout', (async () => {
      let aot = is_async_iterable(
        ao_timeout(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );


    it('ao_debounce', (async () => {
      let aot = is_async_iterable(
        ao_debounce(10, [30, 20, 10, 15]));
      let g = ao_iter(aot);

      expect(aot.when_run).to.be.a('promise');

      let p = g.next();
      expect(p).to.be.a('promise');

      let {value} = await p;
      assert.equal(15, value);

      await aot.when_run;}) );


    it('ao_iter_fenced with ao_interval as rate limit', (async () => {
      let g = is_gen(
        ao_iter_fenced(
          [30, 20, 10, 15]
        , ao_interval(10)) );

      let p = g.next();
      expect(p).to.be.a('promise');

      let {value} = await p;
      expect(value).to.equal(30);

      let lst = [value];
      for await (let v of g) {
        lst.push(v);}

      expect(lst).to.deep.equal(
        [30, 20, 10, 15]); }) );


    it('ao_times', (async () => {
      let g = is_gen(ao_times(ao_interval(10)));

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value: [ts1]} = await p;
        assert(ts1 >= 0);

        let {value: [ts2]} = await g.next();
        assert(ts2 >= ts1);}

      finally {
        g.return();} }) ); }) );

  describe('dom animation frames', (() => {
    it('shape', (() => {
      is_fn(ao_dom_animation); }) );

    if ('undefined' !== typeof requestAnimationFrame) {

      it('ao_dom_animation', (async () => {
        let aot = is_async_iterable(ao_dom_animation());
        let g = ao_iter(aot);

        try {
          let p = g.next();
          expect(p).to.be.a('promise');

          let {value} = await p;
          assert(value >= 0);}

        finally {
          g.return();} }) );

      it('ao_times', (async () => {
        let g = is_gen(ao_times(ao_dom_animation()));

        try {
          let p = g.next();
          expect(p).to.be.a('promise');

          let {value: ts1} = await p;
          assert(ts1 >= 0);

          let {value: ts2} = await g.next();
          assert(ts2 >= ts1);}

        finally {
          g.return();} }) ); } }) );

  describe('dom events', (() => {
    it('shape', (() => {
      is_fn(ao_dom_listen);

      let de = is_async_iterable(ao_dom_listen());
      is_gen(de.g_in);
      is_fn(de.with_dom); }) );


    it('shape of with_dom', (() => {
      let mock ={
        addEventListener(evt, fn, opt) {} };

      let e_ctx = ao_dom_listen()
        .with_dom(mock);

      is_fn(e_ctx.with_dom);
      is_fn(e_ctx.listen); }) );


    if ('undefined' !== typeof MessageChannel) {

      it('message channels', (async () => {
        const {port1, port2} = new MessageChannel();

        const ao_tgt = ao_dom_listen();
        let z = array_from_ao_iter(ao_tgt);

        ao_tgt
          .with_dom(port2, void port2.start())
          .listen('message', evt =>({test_name: evt.data}));

        {(async ()=>{
          for (let m of ['a', 'b', 'c']) {
            port1.postMessage(`from msg port1: ${m}`);
            await delay(1);}

          ao_tgt.g_in.return();
          port1.close();})();}

        let expected =[
          {test_name: 'from msg port1: a'}
        , {test_name: 'from msg port1: b'}
        , {test_name: 'from msg port1: c'} ];

        expect(await z).to.deep.equal(expected);}) ); } }) );

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvdHJhY2suanN5IiwiLi4vdW5pdC9mZW5jZV92LmpzeSIsIi4uL3VuaXQvZmVuY2VfZm4uanN5IiwiLi4vdW5pdC9mZW5jZV9vYmouanN5IiwiLi4vdW5pdC93aGVuX2RlZmVyLmpzeSIsIi4uL3VuaXQvd2hlbl90cmFjay5qc3kiLCIuLi91bml0L3doZW5fZmVuY2UuanN5IiwiLi4vdW5pdC9mZW5jZV9vdXQuanN5IiwiLi4vdW5pdC9mZW5jZV9pbi5qc3kiLCIuLi91bml0L3hmb3JtLmpzeSIsIi4uL3VuaXQvZm9sZC5qc3kiLCIuLi91bml0L3F1ZXVlLmpzeSIsIi4uL3VuaXQvZmVuY2VfYmFyZS5qc3kiLCIuLi91bml0L2ZlbmNlX3N0cmVhbS5qc3kiLCIuLi91bml0L3RpbWUuanN5IiwiLi4vdW5pdC9kb21fYW5pbS5qc3kiLCIuLi91bml0L2RvbV9saXN0ZW4uanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgYXNzZXJ0LCBleHBlY3QgfSA9IHJlcXVpcmUoJ2NoYWknKVxuZXhwb3J0IEB7fSBhc3NlcnQsIGV4cGVjdFxuXG5leHBvcnQgY29uc3QgZGVsYXkgPSAobXM9MSkgPT4gXG4gIG5ldyBQcm9taXNlIEAgeSA9PlxuICAgIHNldFRpbWVvdXQgQCB5LCBtcywgJ3RpbWVvdXQnXG5cbmV4cG9ydCBjb25zdCBkZWxheV9yYWNlID0gKHAsIG1zPTEpID0+IFxuICBQcm9taXNlLnJhY2UgQCMgcCwgZGVsYXkobXMpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGRlbGF5X3dhbGsoZ19pbiwgbXM9MSkgOjpcbiAgYXdhaXQgZGVsYXkobXMpXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnX2luIDo6XG4gICAgeWllbGQgdlxuICAgIGF3YWl0IGRlbGF5KG1zKVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZm4oZm4pIDo6XG4gIGV4cGVjdChmbikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICByZXR1cm4gZm5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2dlbihnKSA6OlxuICBpc19mbihnLm5leHQpXG4gIGlzX2ZuKGcucmV0dXJuKVxuICBpc19mbihnLnRocm93KVxuICByZXR1cm4gZ1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmVuY2VfY29yZShmKSA6OlxuICBpc19mbihmLmZlbmNlKVxuICBpc19mbihmLmFvX2ZvcmspXG4gIGlzX2FzeW5jX2l0ZXJhYmxlKGYpXG5cbiAgaXNfZm4oZi5hb19jaGVja19kb25lKVxuICAvLyBpc19mbihmLmNoYWluKSAtLSBtb3ZlZCB0byBleHBlcmltZW50YWwvY2hhaW4ubWRcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2dlbihmKSA6OlxuICBpc19mZW5jZV9jb3JlKGYpXG4gIGlzX2ZuKGYuYWJvcnQpXG4gIGlzX2ZuKGYucmVzdW1lKVxuXG4gIGlzX2dlbihmKVxuICByZXR1cm4gZlxuXG5leHBvcnQgZnVuY3Rpb24gaXNfYXN5bmNfaXRlcmFibGUobykgOjpcbiAgYXNzZXJ0IEAgbnVsbCAhPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgJ2FzeW5jIGl0ZXJhYmxlJ1xuICByZXR1cm4gb1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXJyYXlfZnJvbV9hb19pdGVyKGcpIDo6XG4gIGxldCByZXMgPSBbXVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgIHJlcy5wdXNoKHYpXG4gIHJldHVybiByZXNcblxuIiwiY29uc3QgaXNfYW9faXRlciA9IGcgPT5cbiAgbnVsbCAhPSBnW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTtcblxuY29uc3QgaXNfYW9fZm4gPSB2X2ZuID0+XG4gICdmdW5jdGlvbicgPT09IHR5cGVvZiB2X2ZuXG4gICAgJiYgISBpc19hb19pdGVyKHZfZm4pO1xuXG5cbmNvbnN0IGFvX2RvbmUgPSBPYmplY3QuZnJlZXplKHthb19kb25lOiB0cnVlfSk7XG5jb25zdCBhb19jaGVja19kb25lID0gZXJyID0+IHtcbiAgaWYgKGVyciAhPT0gYW9fZG9uZSAmJiBlcnIgJiYgIWVyci5hb19kb25lKSB7XG4gICAgdGhyb3cgZXJyfVxuICByZXR1cm4gdHJ1ZX07XG5cblxuY29uc3QgX2FnX2NvcHkgPSAoe2dfaW59LCBhZ19vdXQpID0+KFxuICB1bmRlZmluZWQgPT09IGdfaW4gPyBhZ19vdXQgOihcbiAgICBhZ19vdXQuZ19pbiA9IGdfaW5cbiAgLCBhZ19vdXQpICk7XG5cbmZ1bmN0aW9uIGFvX3doZW5fbWFwKGFvX2ZuX3YsIGRiPW5ldyBNYXAoKSwgcmVqZWN0X2RlbGV0ZWQpIHtcbiAgbGV0IGlkeF9kZWwgPSByZWplY3RfZGVsZXRlZCA/IDIgOiAxO1xuICByZXR1cm4ge1xuICAgIGhhczogayA9PiBkYi5oYXMoaylcbiAgLCBnZXQ6IGsgPT4gYXQoaylbMF0gLy8gcHJvbWlzZSBvZiBkZWZlcnJlZFxuICAsIHNldDogZGVmaW5lLCBkZWZpbmVcbiAgLCBkZWxldGUoaykge1xuICAgICAgbGV0IGIsIGUgPSBkYi5nZXQoayk7XG4gICAgICBpZiAoYiA9ICh1bmRlZmluZWQgIT09IGUpKSB7XG4gICAgICAgIGRiLmRlbGV0ZShrKTtcbiAgICAgICAgZVtpZHhfZGVsXSgpOyB9Ly8gZS5nLiByZXNvbHZlKHVuZGVmaW5lZClcbiAgICAgIHJldHVybiBifVxuICAsIGNsZWFyKCkge1xuICAgICAgLy8gXCJkZWxldGVcIiByZW1haW5pbmcgb24gbmV4dCBwcm9taXNlIHRpY2tcbiAgICAgIHAgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIGZvciAobGV0IGUgb2YgZGIudmFsdWVzKCkpIHtcbiAgICAgICAgcC50aGVuKGVbaWR4X2RlbF0pOyB9Ly8gZS5nLiByZXNvbHZlICh1bmRlZmluZWQpXG5cbiAgICAgIGRiLmNsZWFyKCk7IH0gfS8vIGNsZWFyIGRiXG5cbiAgZnVuY3Rpb24gYXQoaykge1xuICAgIGxldCBlID0gZGIuZ2V0KGspO1xuICAgIGlmICh1bmRlZmluZWQgPT09IGUpIHtcbiAgICAgIGRiLnNldChrLCBlPWFvX2ZuX3YoKSk7fVxuICAgIHJldHVybiBlfVxuXG4gIGZ1bmN0aW9uIGRlZmluZShrLCB2KSB7XG4gICAgbGV0IFtwLCBmbl9mdWxmaWxsXSA9IGF0KGspO1xuICAgIGZuX2Z1bGZpbGwodik7IC8vIGUuZy4gZGVmZXJyZWQncyByZXNvbHZlKHYpIG9yIGZlbmNlJ3MgcmVzdW1lKHYpXG4gICAgcmV0dXJuIHAgfSB9Ly8gcHJvbWlzZSBvZiBkZWZlcnJlZFxuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgLy8gYXZvaWQgZ2FyYmFnZSBjb2xsZWN0aW5nIF9wc2V0IGJ5IHVzaW5nIGEgY2xvc3VyZSBvdmVyIGxvY2FsIHZhcmlhYmxlc1xuICBsZXQgeSxuLF9wc2V0ID0gKGEsYikgPT4geyB5PWEsIG49YjsgfTtcbiAgcmV0dXJuIHAgPT4oXG4gICAgLy8gY3JlYXRlIHRoZSBwcm9taXNlIGFuZCBpbW1lZGlhdGVseSBjYXB0dXJlIGxvY2FsbHkgc2V0IGNsb3N1cmUgdmFyaWFibGVzIGZyb20gX3BzZXQgb3B0aW1pemF0aW9uXG4gICAgcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuICAsIGFzX3JlcyhwLCB5LCBuKSkgfVxuXG5jb25zdCBhb19kZWZlcl92ID0gLyogI19fUFVSRV9fICovXG4gIGFvX2RlZmVyX2N0eCgpO1xuXG5jb25zdCBhb19kZWZlcl9vID0gLyogI19fUFVSRV9fICovXG4gIGFvX2RlZmVyX2N0eCgocCx5LG4pID0+XG4gICAgKHtwcm9taXNlOiBwLCByZXNvbHZlOiB5LCByZWplY3Q6IG59KSk7XG5cbmNvbnN0IGFvX2RlZmVyX3doZW4gPSBkYiA9PlxuICBhb193aGVuX21hcChhb19kZWZlcl92LCBkYik7XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4pIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIGNsb3NlX3RndCkge1xuICBpZiAoaXNfYW9fZm4oZ2VuX3RndCkpIHtcbiAgICBnZW5fdGd0ID0gZ2VuX3RndCgpO1xuICAgIGdlbl90Z3QubmV4dCgpO31cblxuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgaWYgKGRvbmUpIHticmVha30gfVxuXG4gIGlmIChjbG9zZV90Z3QpIHtcbiAgICBhd2FpdCBnZW5fdGd0LnJldHVybigpO30gfVxuXG5cblxuZnVuY3Rpb24gKiBpdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9faXRlcl9mZW5jZWQoaXRlcmFibGUsIGZfZ2F0ZSwgaW5pdGlhbD1mYWxzZSkge1xuICBsZXQgZiA9IHRydWUgPT09IGluaXRpYWwgPyBmX2dhdGUuZmVuY2UoKSA6IGluaXRpYWw7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICBhd2FpdCBmO1xuICAgIHlpZWxkIHY7XG4gICAgZiA9IGZfZ2F0ZS5mZW5jZSgpO30gfVxuXG5cbmNvbnN0IGFvX2l0ZXJfZmVuY2VkID0gKC4uLmFyZ3MpID0+XG4gIF9hZ19jb3B5KGFyZ3NbMF0sIF9hb19pdGVyX2ZlbmNlZCguLi5hcmdzKSk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX28ocHJvdG8pIHtcbiAgbGV0IHIgPSBhb19mZW5jZV92KCk7XG4gIHJldHVybiB7X19wcm90b19fOiBwcm90byxcbiAgICBmZW5jZTogclswXSwgcmVzdW1lOiByWzFdLCBhYm9ydDogclsyXX0gfVxuXG5mdW5jdGlvbiBhb19mZW5jZV92KCkge1xuICBsZXQgeCwgcD0wOyAvLyB4IGlzIHRoZSBjdXJyZW50IGRlZmVycmVkOyBwIGlzIHRoZSBwcm9taXNlIG9yIDBcbiAgLy8gd2hlbiBwIGlzIDAsIGNhbGxpbmcgZmVuY2UoKSByZXNldHMgdGhlIHN5c3RlbTsgb3RoZXJ3aXNlIHAgaXMgdGhlIGN1cnJlbnRseSBhd2FpdGVkIHByb21pc2VcbiAgbGV0IGZlbmNlICA9ICgpID0+ICggMCE9PXAgPyBwIDogcD0oeD1hb19kZWZlcl92KCkpWzBdICk7XG4gIC8vIHdoZW4gcCBpcyBub3QgMCwgcmVzb2x2ZSBkZWZlcnJlZCBpbiB4XG4gIGxldCByZXN1bWUgPSBhbnMgPT4geyBpZiAoMCE9PXApIHsgcD0wOyB4WzFdKGFucyk7IH19O1xuICAvLyB3aGVuIHAgaXMgbm90IDAsIHJlamVjdCBkZWZlcnJlZCBpbiB4XG4gIGxldCBhYm9ydCAgPSBlcnIgPT4geyBpZiAoMCE9PXApIHsgcD0wOyB4WzJdKGVyciB8fCBhb19kb25lKTsgfX07XG4gIHJldHVybiBbZmVuY2UsIHJlc3VtZSwgYWJvcnRdIH1cblxuXG5jb25zdCBhb19mZW5jZV93aGVuID0gZGIgPT5cbiAgYW9fd2hlbl9tYXAoYW9fZmVuY2VfdiwgZGIpO1xuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXJfZmVuY2UoZmVuY2UpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHIgPSBhd2FpdCBmZW5jZSgpO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gcikge1xuICAgICAgICB5aWVsZCByO30gfSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID0ge1xuICBhb19jaGVja19kb25lXG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSBhb19pdGVyX2ZlbmNlKHRoaXMuZmVuY2UpO1xuICAgIGxldCB7eGVtaXR9ID0gdGhpcztcbiAgICByZXR1cm4geGVtaXQgPyB4ZW1pdChhZykgOiBhZ30gfTtcblxuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9ICgpID0+XG4gIGFvX2ZlbmNlX28oX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG5cblxuZnVuY3Rpb24gYXNfaXRlcl9wcm90byhyZXN1bWUsIGFib3J0LCBkb25lID0gdHJ1ZSkge1xuICByZXR1cm4ge1xuICAgIG5leHQ6IHYgPT4oe3ZhbHVlOiByZXN1bWUodiksIGRvbmV9KVxuICAsIHJldHVybjogKCkgPT4oe3ZhbHVlOiBhYm9ydChhb19kb25lKSwgZG9uZX0pXG4gICwgdGhyb3c6IChlcnIpID0+KHt2YWx1ZTogYWJvcnQoZXJyKSwgZG9uZX0pIH0gfVxuXG5mdW5jdGlvbiBhb19zcGxpdChpdGVyYWJsZSkge1xuICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vYmooKTtcbiAgZl9vdXQud2hlbl9ydW4gPSBfYW9fcnVuKGl0ZXJhYmxlLCBmX291dCk7XG4gIGZfb3V0LmdfaW4gPSBpdGVyYWJsZS5nX2luO1xuICByZXR1cm4gZl9vdXR9XG5cbmFzeW5jIGZ1bmN0aW9uIF9hb19ydW4oaXRlcmFibGUsIGZfdGFwKSB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgICAgZl90YXAucmVzdW1lKHYpO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cblxuZnVuY3Rpb24gYW9fdGFwKGl0ZXJhYmxlKSB7XG4gIGxldCBmX3RhcCA9IGFvX2ZlbmNlX29iaigpO1xuICBsZXQgYWdfdGFwID0gX2FvX3RhcChpdGVyYWJsZSwgZl90YXApO1xuICBhZ190YXAuZl90YXAgPSBhZ190YXAuZl9vdXQgPSBmX3RhcDtcbiAgYWdfdGFwLmdfaW4gPSBmX3RhcC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIFtmX3RhcCwgYWdfdGFwXX1cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTtcbiAgICAgIHlpZWxkIHY7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG5cbiAgZmluYWxseSB7XG4gICAgZl90YXAuYWJvcnQoKTt9IH1cblxuZnVuY3Rpb24gYW9fdHJhY2socHJvdG8sIHJlc2V0X3YpIHtcbiAgbGV0IHIgPSBhb190cmFja192KHJlc2V0X3YpO1xuICByZXR1cm4ge19fcHJvdG9fXzogcHJvdG8sXG4gICAgdGlwOiAoKSA9PiByWzBdIC8vIG9yIGZlbmNlKGZhbHNlKVxuICAsIHJlc3VtZTogclsxXVxuICAsIGFib3J0OiByWzJdXG4gICwgZmVuY2U6IHJbM11cbiAgLCBmdHI6ICgpID0+IHJbNF0gfSB9Ly8gb3IgZmVuY2UodHJ1ZSlcblxuZnVuY3Rpb24gYW9fdHJhY2tfdihyZXNldF92ID0gKCk9PmFvX2RlZmVyX3YoKSkge1xuICAvLyBsaWtlIGFvX2RlZmVyX3YoKSBhbmQgcmVzZXRhYmxlIGxpa2UgYW9fZmVuY2VfdigpXG4gIGxldCByOyAvLyByIGlzIHRoZSBjdXJyZW50IC8gdHJhY2tlZCB2YWx1ZSBkZWZpbmVkIGJlbG93XG4gIGxldCB4PXJlc2V0X3YoKTsgLy8geCBpcyB0aGUgZnV0dXJlL2RlZmVycmVkXG5cbiAgbGV0IHA7IC8vIHAgaXMgdGhlIHJhY2hldCBtZW1vcnkgZm9yIHRoZSBmZW5jZSgpIGNsb3N1cmVcbiAgLy8gc2ltaWxhciB0byBmZW5jZS5mZW5jZSgpIHdoaWxlIGFsc28gdHJhY2tpbmcgdGhlIGxhc3QgY29tcGxldGVkIGRlZmVycmVkXG4gIGxldCBmZW5jZSA9IGZ0ciA9PihcbiAgICBmYWxzZT09PWZ0ciA/IHJbMF0gOiB0cnVlPT09ZnRyID8geFswXSA6IC8vIG5vbi1yYWNoZXRpbmcgcXVlcmllc1xuICAgIHA9PT14WzBdIHx8IHA9PT1yWzBdID8gcD14WzBdIDogcD1yWzBdICk7Ly8gcmFjaGV0aW5nIHF1ZXJ5XG5cbiAgLy8gbGlrZSBmZW5jZS5yZXN1bWUsIHJlc29sdmVzIHRoZSBmdXR1cmUvZGVmZXJyZWQgeFswXTsgdGhlbiByZXNldHMgeCBmdXR1cmUvZGVmZXJyZWRcbiAgbGV0IHJlc3VtZSA9IGFucyA9PiB4eih4WzFdLCBhbnMpO1xuXG4gIC8vIGxpa2UgZmVuY2UuYWJvcnQsIHJlamVjdHMgdGhlIGZ1dHVyZS9kZWZlcnJlZCB4WzBdOyB0aGVuIHJlc2V0cyB4IGZ1dHVyZS9kZWZlcnJlZFxuICBsZXQgYWJvcnQgID0gZXJyID0+IHh6KHhbMl0sIGVyciB8fCBhb19kb25lKTtcblxuICAvLyBtYXRjaCBhb19kZWZlcl92KCkgb2YgW2N1cnJlbnQgcHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0XSB3aXRoIGFkZGl0aW9uYWwgW2ZlbmNlLCBmdHIgcHJvbWlzZV1cbiAgcmV0dXJuIHIgPSBbIHA9eFswXSwgcmVzdW1lLCBhYm9ydCwgZmVuY2UsIHhbMF0gXVxuXG4gIGZ1bmN0aW9uIHh6KHhmLCB2KSB7XG4gICAgLy8gMS4gdXBkYXRlIGN1cnJlbnQgLyB0aXAgc2xvdDogclswXSA9IHhbMF1cbiAgICAvLyAyLiByZS1wcmltZSBmZW5jZTogeCA9IHJlc2V0X3YoclswXV1cbiAgICB4ID0gcmVzZXRfdihyWzBdID0geFswXSk7XG4gICAgcls0XSA9IHhbMF07IC8vIHVwZGF0ZSBwdWJsaWMgZnRyIHNsb3RcbiAgICB4Zih2KTsgfSB9Ly8gcmVzdW1lL2Fib3J0IHJbMF0gY3VycmVudCAvIHRpcFxuXG5cbmNvbnN0IGFvX3RyYWNrX3doZW4gPSBkYiA9PlxuICBhb193aGVuX21hcChhb190cmFja192LCBkYik7XG5cbmZ1bmN0aW9uIGFvX3RyYWNrX2ZuKHRndCwgcmVzZXRfdikge1xuICBsZXQgciA9IGFvX3RyYWNrX3YocmVzZXRfdik7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IHJbM107fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG4gIHJldHVybiByfVxuXG5jb25zdCBhb190cmFja19vYmogPSAoKSA9PlxuICBhb190cmFjayhfYW9fZmVuY2VfY29yZV9hcGlfKTtcblxuY29uc3QgYW9fZmVuY2Vfb3V0ID0gLyogI19fUFVSRV9fICovIGFvX2ZlbmNlX28uYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19ib3VuZCgpfVxuLCBhb19ib3VuZCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FvX2ZlbmNlX291dCBub3QgYm91bmQnKX1cbiwgX2FvX21hbnkoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgY29uc3VtZWQ7IGNvbnNpZGVyIC5hb19mb3JrKCkgb3IgLmFsbG93X21hbnkoKScpfVxuXG4sIGFsbG93X21hbnkoKSB7XG4gICAgbGV0IHthb19mb3JrLCBhb19ib3VuZCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICBpZiAoX2FvX21hbnkgPT09IGFvX2JvdW5kKSB7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gYW9fZm9yazt9XG4gICAgdGhpcy5fYW9fbWFueSA9IGFvX2Zvcms7XG4gICAgdGhpcy5hbGxvd19tYW55ID0gKCkgPT4gdGhpcztcbiAgICByZXR1cm4gdGhpc31cblxuLCBhb19ydW4oKSB7XG4gICAgbGV0IHt3aGVuX3J1bn0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHdoZW5fcnVuKSB7XG4gICAgICB0aGlzLndoZW5fcnVuID0gd2hlbl9ydW4gPVxuICAgICAgICBhb19ydW4odGhpcy5hb19ib3VuZCgpKTsgfVxuICAgIHJldHVybiB3aGVuX3J1bn1cblxuLCBiaW5kX2dhdGVkKGZfZ2F0ZSkge1xuICAgIGxldCBhZ19vdXQgPSB0aGlzLl9hb19nYXRlZChmX2dhdGUpO1xuICAgIGFnX291dC5mX291dCA9IHRoaXM7XG4gICAgYWdfb3V0LmdfaW4gPSB0aGlzLmdfaW47XG4gICAgdGhpcy5hb19ib3VuZCA9ICgoKSA9PiB7XG4gICAgICBsZXQge3hlbWl0LCBfYW9fbWFueX0gPSB0aGlzO1xuICAgICAgdGhpcy5hb19ib3VuZCA9IF9hb19tYW55O1xuICAgICAgcmV0dXJuIHhlbWl0XG4gICAgICAgID8gX2FnX2NvcHkoYWdfb3V0LCB4ZW1pdChhZ19vdXQpKVxuICAgICAgICA6IGFnX291dH0pO1xuXG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fZ2F0ZWQoZl9nYXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuYmluZF9nYXRlZChmX2dhdGUpLmFvX2JvdW5kKCl9XG5cbiwgX2FvX2dhdGVkKGZfZ2F0ZSkge3JldHVybiBhb2dfZ2F0ZWQodGhpcywgZl9nYXRlKX0gfSApO1xuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX2dhdGVkKGZfb3V0LCBmX2dhdGUpIHtcbiAgdHJ5IHtcbiAgICBmX291dC5yZXN1bWUoKTtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHYgPSBhd2FpdCBmX2dhdGUuZmVuY2UoKTtcbiAgICAgIHlpZWxkIHY7XG4gICAgICBmX291dC5yZXN1bWUodik7fSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX291dC5hYm9ydCgpO1xuICAgIGlmIChmX2dhdGUuYWJvcnQpIHtcbiAgICAgIGZfZ2F0ZS5hYm9ydCgpO30gfSB9XG5cbmNvbnN0IGFvX2ZlZWRlciA9ICh7Z19pbn0pID0+IHYgPT4gZ19pbi5uZXh0KHYpO1xuY29uc3QgYW9fZmVlZGVyX3YgPSAoe2dfaW59KSA9PiAoLi4uYXJncykgPT4gZ19pbi5uZXh0KGFyZ3MpO1xuXG5cbmZ1bmN0aW9uIGFvZ19mZW5jZV94Zih4aW5pdCwgLi4uYXJncykge1xuICBsZXQgZl9pbiA9IGFvX2ZlbmNlX28oKSwgZl9vdXQgPSBhb19mZW5jZV9vKCk7XG4gIGxldCBnX2luID0geGluaXQoZl9pbiwgZl9vdXQsIC4uLmFyZ3MpO1xuICBnX2luLm5leHQoKTtcblxuICBsZXQgcmVzID0gYW9nX2dhdGVkKGZfb3V0LCBmX2luKTtcbiAgcmVzLmZlbmNlID0gZl9vdXQuZmVuY2U7XG4gIHJlcy5nX2luID0gZ19pbjtcbiAgcmV0dXJuIHJlc31cblxuZnVuY3Rpb24gYW9fZmVuY2VfaXRlciguLi5hcmdzKSB7XG4gIHJldHVybiBhb2dfZmVuY2VfeGYoYW9nX2l0ZXIsIC4uLmFyZ3MpfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9zaW5rKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGFvZ19mZW5jZV94Zihhb2dfc2luaywgLi4uYXJncyl9XG5cblxuZnVuY3Rpb24gKiBhb2dfaXRlcihmX2luLCBmX2dhdGUsIHhmKSB7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9ICh4Zi5uZXh0KHRpcCkpLnZhbHVlO31cbiAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgIHtcbiAgICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgICAgIHRpcCA9IChhd2FpdCB4Zi5uZXh0KHRpcCkpLnZhbHVlO31cbiAgICAgICAgZl9pbi5yZXN1bWUodGlwKTt9XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGZfZ2F0ZSkge1xuICAgICAgICBhd2FpdCBmX2dhdGUuZmVuY2UoKTt9IH0gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX2luLmFib3J0KCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cbmNvbnN0IGFvX3hmb3JtID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0obnNfZ2VuKTtcbmNvbnN0IGFvX2ZvbGQgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19mb2xkKG5zX2dlbik7XG5jb25zdCBhb19xdWV1ZSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKG5zX2dlbik7XG5cbmNvbnN0IGFvX2ZlbmNlX2luID0gLyogI19fUFVSRV9fICovIGFvX2ZlbmNlX28uYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgYW9fZm9sZChuc19nZW4pIHtyZXR1cm4gdGhpcy5hb194Zm9ybSh7eGluaXQ6IGFvZ19pdGVyLCAuLi4gbnNfZ2VufSl9XG4sIGFvX3F1ZXVlKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KX1cblxuLCBhb2dfaXRlcih4Zikge3JldHVybiBhb2dfaXRlcih0aGlzKX1cbiwgYW9nX3NpbmsoZl9nYXRlLCB4Zikge3JldHVybiBhb2dfc2luayh0aGlzLCBmX2dhdGUsIHhmKX1cblxuLCBhb194Zm9ybShuc19nZW49e30pIHtcbiAgICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vdXQoKTtcblxuICAgIGxldCB7eGVtaXQsIHhpbml0LCB4cmVjdn0gPVxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4ZW1pdCkge1xuICAgICAgZl9vdXQueGVtaXQgPSB4ZW1pdDt9XG5cbiAgICBpZiAoISB4aW5pdCkge3hpbml0ID0gYW9nX3Npbms7fVxuICAgIGxldCByZXMgPSB4aW5pdCh0aGlzLCBmX291dCxcbiAgICAgIHhyZWN2ID8gX3hmX2dlbi5jcmVhdGUoeHJlY3YpIDogdW5kZWZpbmVkKTtcblxuICAgIGxldCBnX2luID0gZl9vdXQuZ19pbiA9IHJlcy5nX2luIHx8IHJlcztcbiAgICByZXR1cm4gcmVzICE9PSBnX2luXG4gICAgICA/IHJlcyAvLyByZXMgaXMgYW4gb3V0cHV0IGdlbmVyYXRvclxuICAgICAgOigvLyByZXMgaXMgYW4gaW5wdXQgZ2VuZXJhdG9yXG4gICAgICAgICAgZ19pbi5uZXh0KCksXG4gICAgICAgICAgZl9vdXQuYmluZF9nYXRlZCh0aGlzKSkgfVxuXG4sIC8vIEVTMjAxNSBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9ICk7XG5cblxuY29uc3QgX3hmX2dlbiA9IHtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX3B1c2hfc3RyZWFtKGFzX3ZlYykge1xuICBsZXQgcT1bXSwgW2ZlbmNlLCByZXN1bWUsIGFib3J0XSA9IGFvX2ZlbmNlX3YoKTtcbiAgbGV0IHN0cmVhbSA9IGFvX3N0cmVhbV9mZW5jZShmZW5jZSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oc3RyZWFtLHtcbiAgICBzdHJlYW1cbiAgLCBhYm9ydFxuICAsIHB1c2goLi4uIGFyZ3MpIHtcbiAgICAgIGlmICh0cnVlID09PSBhc192ZWMpIHtcbiAgICAgICAgcS5wdXNoKGFyZ3MpO31cbiAgICAgIGVsc2UgcS5wdXNoKC4uLiBhcmdzKTtcblxuICAgICAgcmVzdW1lKHEpO1xuICAgICAgcmV0dXJuIHEubGVuZ3RofSB9ICkgfVxuXG5cbmZ1bmN0aW9uIGFvX3N0cmVhbV9mZW5jZShmZW5jZSkge1xuICBsZXQgW3doZW5fZG9uZSwgcmVzX2RvbmUsIHJlal9kb25lXSA9IGFvX2RlZmVyX3YoKTtcbiAgbGV0IHJlcyA9IF9hb19zdHJlYW1fZmVuY2UoZmVuY2UsIHJlc19kb25lLCByZWpfZG9uZSk7XG4gIHJlcy53aGVuX2RvbmUgPSB3aGVuX2RvbmU7XG4gIHJldHVybiByZXN9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fc3RyZWFtX2ZlbmNlKGZlbmNlLCByZXNvbHZlLCByZWplY3QpIHtcbiAgdHJ5IHtcbiAgICBsZXQgcF9yZWFkeSA9IGZlbmNlKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCBiYXRjaCA9IGF3YWl0IHBfcmVhZHk7XG4gICAgICBiYXRjaCA9IGJhdGNoLnNwbGljZSgwLCBiYXRjaC5sZW5ndGgpO1xuXG4gICAgICBwX3JlYWR5ID0gZmVuY2UoKTtcbiAgICAgIHlpZWxkICogYmF0Y2g7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGlmICghZXJyIHx8IGVyci5hb19kb25lKSB7XG4gICAgICByZXNvbHZlKHRydWUpO31cbiAgICBlbHNlIHJlamVjdChlcnIpO30gfVxuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwKSB7XG4gIGxldCBbX2ZlbmNlLCBfcmVzdW1lLCBfYWJvcnRdID0gYW9fZmVuY2VfZm4oKTtcbiAgbGV0IHRpZCA9IHNldEludGVydmFsKF9yZXN1bWUsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfYWJvcnQoKTt9KTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lLCBfYWJvcnRdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHRpbWVvdXQuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dChtc19uZXh0PW1zKSB7XG4gICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtc19uZXh0LCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgYW9faXRlcmFibGUpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbigpO1xuXG4gIF9mZW5jZS53aGVuX3J1biA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcDtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgYW9faXRlcmFibGUpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7XG4gICAgICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9IH1cblxuICAgICAgYXdhaXQgcDt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGFvX2l0ZXJhYmxlKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGFvX2l0ZXJhYmxlKSB7XG4gICAgeWllbGQgW0RhdGUubm93KCkgLSB0czAsIHZdO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcblxuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzdW1lKTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihzZWxmPWFvX3F1ZXVlKCkpIHtcbiAgcmV0dXJuIF9iaW5kLnNlbGYgPSBzZWxmID17XG4gICAgX19wcm90b19fOiBzZWxmXG4gICwgd2l0aF9kb20oZG9tLCBmbikge1xuICAgICAgcmV0dXJuIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICAgID8gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKVxuICAgICAgICA6IF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBkb20pfSB9XG5cbiAgZnVuY3Rpb24gX2JpbmQoZG9tLCBmbl9ldnQsIGZuX2RvbSkge1xuICAgIHJldHVybiBldnQgPT4ge1xuICAgICAgbGV0IHYgPSBmbl9ldnRcbiAgICAgICAgPyBmbl9ldnQoZXZ0LCBkb20sIGZuX2RvbSlcbiAgICAgICAgOiBmbl9kb20oZG9tLCBldnQpO1xuXG4gICAgICBpZiAobnVsbCAhPSB2KSB7XG4gICAgICAgIHNlbGYuZ19pbi5uZXh0KHYpO30gfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pIHtcbiAgbGV0IF9vbl9ldnQ7XG4gIGlmIChpc19hb19mbihmbikpIHtcbiAgICBfZXZ0X2luaXQudGhlbihcbiAgICAgIF9vbl9ldnQgPSBfYmluZChkb20sIHZvaWQgMCwgZm4pKTsgfVxuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGxldCBvcHQsIGV2dF9mbiA9IF9vbl9ldnQ7XG5cbiAgICAgIGxldCBsYXN0ID0gYXJncy5wb3AoKTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBldnRfZm4gPSBfYmluZChkb20sIGxhc3QsIF9vbl9ldnQpO1xuICAgICAgICBsYXN0ID0gYXJncy5wb3AoKTt9XG5cbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgYXJncy5wdXNoKGxhc3QpO31cbiAgICAgIGVsc2Ugb3B0ID0gbGFzdDtcblxuICAgICAgZm9yIChsZXQgZXZ0IG9mIGFyZ3MpIHtcbiAgICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgZXZ0LCBldnRfZm4sIG9wdCk7IH1cblxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBlY3R4X2xpc3QpIHtcbiAgZWN0eF9saXN0ID0gQXJyYXkuZnJvbShlY3R4X2xpc3QsXG4gICAgZG9tID0+IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkpO1xuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGZvciAobGV0IGVjdHggb2YgZWN0eF9saXN0KSB7XG4gICAgICAgIGVjdHgubGlzdGVuKC4uLmFyZ3MpO31cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuZXhwb3J0IHsgX2FnX2NvcHksIF9hb19mZW5jZV9jb3JlX2FwaV8sIF9hb19pdGVyX2ZlbmNlZCwgX2FvX3J1biwgX2FvX3RhcCwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVyX2N0eCwgYW9fZGVmZXJfbywgYW9fZGVmZXJfdiwgYW9fZGVmZXJfd2hlbiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZG9uZSwgYW9fZHJpdmUsIGFvX2ZlZWRlciwgYW9fZmVlZGVyX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9pbiwgYW9fZmVuY2VfaXRlciwgYW9fZmVuY2VfbywgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9vdXQsIGFvX2ZlbmNlX3NpbmssIGFvX2ZlbmNlX3YsIGFvX2ZlbmNlX3doZW4sIGFvX2ZvbGQsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlLCBhb19pdGVyX2ZlbmNlZCwgYW9fcHVzaF9zdHJlYW0sIGFvX3F1ZXVlLCBhb19ydW4sIGFvX3NwbGl0LCBhb19zdGVwX2l0ZXIsIGFvX3N0cmVhbV9mZW5jZSwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9fdHJhY2ssIGFvX3RyYWNrX2ZuLCBhb190cmFja19vYmosIGFvX3RyYWNrX3YsIGFvX3RyYWNrX3doZW4sIGFvX2RlZmVyX3doZW4gYXMgYW9fd2hlbiwgYW9feGZvcm0sIGFvZ19mZW5jZV94ZiwgYW9nX2dhdGVkLCBhb2dfaXRlciwgYW9nX3NpbmssIGFzX2l0ZXJfcHJvdG8sIGlzX2FvX2ZuLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiaW1wb3J0IHthc3NlcnQsIGlzX2ZufSBmcm9tICcuL191dGlscy5qc3knXG5cbmltcG9ydCB7YW9fZGVmZXJfbywgYW9fZGVmZXJfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcicsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJfb1xuICAgIGlzX2ZuIEAgYW9fZGVmZXJfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG4gICAgaXNfZm4gQCBhb19mZW5jZV9pblxuXG4gIGl0IEAgJ2RyaXZlJywgQDo6XG4gICAgaXNfZm4gQCBpdGVyXG4gICAgaXNfZm4gQCBzdGVwX2l0ZXJcbiAgICBpc19mbiBAIGFvX2l0ZXJcbiAgICBpc19mbiBAIGFvX3N0ZXBfaXRlclxuICAgIFxuICAgIGlzX2ZuIEAgYW9fcnVuXG4gICAgaXNfZm4gQCBhb19kcml2ZVxuXG4gIGl0IEAgJ3NwbGl0JywgQDo6XG4gICAgaXNfZm4gQCBhb19zcGxpdFxuICAgIGlzX2ZuIEAgYW9fdGFwXG5cbiIsImltcG9ydCB7YW9fZGVmZXJfbywgYW9fZGVmZXJfdn0gZnJvbSAncm9hcCdcbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fZGVmZXJfbycsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVyX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJfbyBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJfbygpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICAgIGV4cGVjdChyZXMucHJvbWlzZSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzLnJlc29sdmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMucmVqZWN0KS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcl9vKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyX28oKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1bihnKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3RcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBnX3RndC5uZXh0KCdmaW5hbCcpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgICdzZWNvbmQnXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG4gICAgICAnZmluYWwnXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KGxzdCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4gIGl0IEAgJ2FvX2RyaXZlIGZ1bmN0aW9uJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdlbl90ZXN0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgIDE5NDJcbiAgICAgIDIwNDJcbiAgICAgIDIxNDJcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QoKSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiIsImltcG9ydCB7aXRlciwgYW9faXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3RlcF9pdGVyLCBzdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZ2VuXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZSBpdGVycycsIEA6OlxuXG4gIGl0IEAgJ25vcm1hbCBpdGVyJywgQDo6XG4gICAgbGV0IGcgPSBpc19nZW4gQCBpdGVyIEAjIDEwLCAyMCwgMzBcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBnLm5leHQoKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlcicsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX2l0ZXIgQCMgMTAsIDIwLCAzMFxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGF3YWl0IHBcblxuXG4gIGl0IEAgJ25vcm1hbCBzdGVwX2l0ZXInLCBAOjpcbiAgICBsZXQgeiA9IEFycmF5LmZyb20gQFxuICAgICAgemlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG4gICAgZnVuY3Rpb24gKiB6aXAoYSwgYikgOjpcbiAgICAgIGIgPSBzdGVwX2l0ZXIoYilcbiAgICAgIGZvciBsZXQgYXYgb2YgaXRlcihhKSA6OlxuICAgICAgICBmb3IgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG5cbiAgaXQgQCAnYXN5bmMgYW9fc3RlcF9pdGVyJywgQDo6PlxuICAgIGxldCB6ID0gYXdhaXQgYXJyYXlfZnJvbV9hb19pdGVyIEBcbiAgICAgIGFvX3ppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gKiBhb196aXAoYSwgYikgOjpcbiAgICAgIGIgPSBhb19zdGVwX2l0ZXIoYilcbiAgICAgIGZvciBhd2FpdCBsZXQgYXYgb2YgYW9faXRlcihhKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG4iLCJpbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBzcGxpdCcsIEA6OlxuXG4gIGl0IEAgJ2FvX3NwbGl0IHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjA0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMTQyKVxuXG4gICAgICBhd2FpdCBncy53aGVuX3J1blxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cblxuICBpdCBAICdhb190YXAgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBbZl9vdXQsIGFnX3RhcF0gPSBhb190YXAoZylcbiAgICAgIGlzX2FzeW5jX2l0ZXJhYmxlIEAgZl9vdXRcbiAgICAgIGlzX2dlbiBAIGFnX3RhcFxuXG4gICAgICBleHBlY3QoZl9vdXQuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBmX291dC5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0KVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYWdfdGFwKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cbiIsImltcG9ydCB7YW9fdHJhY2tfdiwgYW9fdHJhY2t9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fdHJhY2snLCBAOjpcblxuICBkZXNjcmliZSBAICdhb190cmFja192IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5JylcbiAgICAgIGV4cGVjdChyZXMpLnRvLmhhdmUubGVuZ3RoKDUpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbM10pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbNF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAvLyBmdXR1cmUgYW5kIGN1cnJlbnQgc3RhcnQgb3V0IHRoZSBzYW1lXG4gICAgICBleHBlY3QocmVzWzBdKS50by5lcXVhbChyZXNbNF0pXG5cbiAgICBpdCBAICd0cmFjayBmZW5jZSgpJywgQDo6PlxuICAgICAgY29uc3QgdnQgPSBhb190cmFja192KClcbiAgICAgIGNvbnN0IFtwdGlwLCByZXN1bWUsIGFib3J0LCBmZW5jZV0gPSB2dFxuXG4gICAgICAvLyB1bnRpbCBmaXJzdCByZXN1bWUsIGZlbmNlIGFuZCB0aXAgYXJlIHRoZSBzYW1lXG4gICAgICBsZXQgcGYwID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMCkudG8uZXF1YWwocHRpcClcbiAgICAgIGxldCBwZjEgPSBmZW5jZSgpXG4gICAgICBleHBlY3QocGYxKS50by5lcXVhbChwZjApXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLmVxdWFsKHBmMSlcblxuICAgICAgZXhwZWN0KHZ0WzBdKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwodnRbMF0pXG4gICAgICByZXN1bWUoNDIpIC8vIHJhY2hldCBmaXJzdCByZXNvbHZlZCBwcm9taXNlIGZvcndhcmRcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHZ0WzBdKVxuICAgICAgZXhwZWN0KHZ0WzBdKS50by5lcXVhbChwdGlwKVxuXG4gICAgICBsZXQgcGYyID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMikudG8ubm90LmVxdWFsKHBmMSlcbiAgICAgIGxldCBwZjMgPSBmZW5jZSgpXG4gICAgICBleHBlY3QocGYzKS50by5lcXVhbChwZjIpXG5cbiAgICAgIGV4cGVjdCh2dFswXSkudG8uZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChmZW5jZSh0cnVlKSkudG8uZXF1YWwocGYzKVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwodnRbMF0pXG4gICAgICByZXN1bWUoMTk0MikgLy8gcmFjaGV0IGZpcnN0IHJlc29sdmVkIHByb21pc2UgZm9yd2FyZFxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwodnRbMF0pXG4gICAgICBleHBlY3QodnRbMF0pLnRvLm5vdC5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KHZ0WzBdKS50by5lcXVhbChwZjMpXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLm5vdC5lcXVhbChwZjMpXG5cbiAgICAgIGxldCBwZjQgPSBmZW5jZSgpXG4gICAgICBleHBlY3QocGY0KS50by5ub3QuZXF1YWwodnRbMF0pXG4gICAgICBleHBlY3QocGY0KS50by5ub3QuZXF1YWwocGYzKVxuXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLmVxdWFsKHBmNClcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHZ0WzBdKVxuICAgICAgXG4gICAgICBleHBlY3QoYXdhaXQgcHRpcCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYwKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjEpLnRvLmVxdWFsKDQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMikudG8uZXF1YWwoMTk0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjMpLnRvLmVxdWFsKDE5NDIpXG5cblxuICAgIGl0IEAgJ3VzZSwgcmVzdW1lIHdpdGggZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwdGlwLCByZXN1bWUsIGFib3J0LCBmZW5jZV0gPSBhb190cmFja192KClcbiAgICAgIHJlc3VtZSg0MikgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgbGV0IHBmMCA9IGZlbmNlKCkgLy8gZmlyc3QgdXNlIG9mIGZlbmNlLCBzaG91bGQgYmUgc2FtZSBhcyBwdGlwXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjApLnRvLm5vdC5lcXVhbChwdGlwKVxuXG4gICAgICBsZXQgcGYxID0gZmVuY2UoKSAvLyBzZWNvbmQgdXNlIG9mIGZlbmNlLCBzaG91bGQgYmUgZGlmZmVyZW50IGZyb20gcHRpcFxuICAgICAgZXhwZWN0KHBmMSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYxKS50by5lcXVhbChwZjApXG5cbiAgICAgIHJlc3VtZSgxOTQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBleHBlY3QoYXdhaXQgcHRpcCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYwKS50by5lcXVhbCgxOTQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMSkudG8uZXF1YWwoMTk0MilcblxuICAgIGl0IEAgJ3VzZSwgYWJvcnQgd2l0aCBmZW5jZSgpJywgQDo6PlxuICAgICAgY29uc3QgW3B0aXAsIHJlc3VtZSwgYWJvcnQsIGZlbmNlXSA9IGFvX3RyYWNrX3YoKVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcblxuICAgICAgYWJvcnQobmV3IEVycm9yKCdub3BlJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuXG4gICAgICBsZXQgcGYwID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5lcXVhbChwZjApXG5cbiAgICAgIGxldCBwZjEgPSBmZW5jZSgpXG4gICAgICBleHBlY3QocGYxKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmVxdWFsKHBmMClcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLmVxdWFsKHBmMSlcblxuICAgICAgYWJvcnQobmV3IEVycm9yKCdub3QsIGFnYWluJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbChwZjEpXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLm5vdC5lcXVhbChwZjApXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwdGlwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlIC8vIGF3YWl0IHB0aXBcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vdCwgYWdhaW4nLCBlcnIubWVzc2FnZSAvLyBhd2FpdCBwZjBcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMVxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vdCwgYWdhaW4nLCBlcnIubWVzc2FnZSAvLyBhd2FpdCBwZjFcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX3RyYWNrIG9iamVjdCcsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb190cmFjaygpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICAgIGV4cGVjdChyZXMudGlwKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlc3VtZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5hYm9ydCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5mdHIpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgZXhwZWN0KHJlcy50aXAoKSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzLmZ0cigpKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIC8vIGZ1dHVyZSBhbmQgY3VycmVudCBzdGFydCBvdXQgdGhlIHNhbWVcbiAgICAgIGV4cGVjdChyZXMudGlwKCkpLnRvLmVxdWFsKHJlcy5mdHIoKSlcblxuICAgIGl0IEAgJ3VzZSwgcmVzdW1lIHdpdGggZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrKCksIHB0aXAgPSByZXMudGlwKClcbiAgICAgIHJlcy5yZXN1bWUoNDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwZjAgPSByZXMuZmVuY2UoKSAvLyBmaXJzdCB1c2Ugb2YgZmVuY2UsIHNob3VsZCBiZSBzYW1lIGFzIHB0aXBcbiAgICAgIGV4cGVjdChwZjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMCkudG8ubm90LmVxdWFsKHB0aXApXG5cbiAgICAgIGxldCBwZjEgPSByZXMuZmVuY2UoKSAvLyBzZWNvbmQgdXNlIG9mIGZlbmNlLCBzaG91bGQgYmUgZGlmZmVyZW50IGZyb20gcHRpcFxuICAgICAgZXhwZWN0KHBmMSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYxKS50by5lcXVhbChwZjApXG5cbiAgICAgIHJlcy5yZXN1bWUoMTk0MikgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgZXhwZWN0KGF3YWl0IHB0aXApLnRvLmVxdWFsKDQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMCkudG8uZXF1YWwoMTk0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjEpLnRvLmVxdWFsKDE5NDIpXG5cbiAgICBpdCBAICd1c2UsIGFib3J0IHdpdGggZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrKCksIHB0aXAgPSByZXMudGlwKClcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuXG4gICAgICByZXMuYWJvcnQobmV3IEVycm9yKCdub3BlJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG4gICAgICBleHBlY3QocmVzLmZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcblxuICAgICAgbGV0IHBmMCA9IHJlcy5mZW5jZSgpXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZSh0cnVlKSkudG8uZXF1YWwocGYwKVxuXG4gICAgICBsZXQgcGYxID0gcmVzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMSkudG8uZXF1YWwocGYwKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZShmYWxzZSkpLnRvLmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QocmVzLmZlbmNlKHRydWUpKS50by5lcXVhbChwZjEpXG5cbiAgICAgIHJlcy5hYm9ydChuZXcgRXJyb3IoJ25vdCwgYWdhaW4nKSkgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UoZmFsc2UpKS50by5lcXVhbChwZjEpXG4gICAgICBleHBlY3QocmVzLmZlbmNlKHRydWUpKS50by5ub3QuZXF1YWwocGYwKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcHRpcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZSAvLyBhd2FpdCBwdGlwXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3QsIGFnYWluJywgZXJyLm1lc3NhZ2UgLy8gYXdhaXQgcGYwXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjFcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3QsIGFnYWluJywgZXJyLm1lc3NhZ2UgLy8gYXdhaXQgcGYxXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBkZWxheV9yYWNlfSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICBsZXQgZiwgZnpcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuICAgIGFzc2VydC5lcXVhbCBAICd0d28nLCBhd2FpdCBmXG5cbiAgICByZXN1bWUgQCAnZm91cidcbiAgICByZXN1bWUgQCAnZml2ZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICdzaXgnXG4gICAgcmVzdW1lIEAgJ3NldmVuJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3NpeCcsIGF3YWl0IGZcblxuXG4gIGl0IEAgJ25ldmVyIGJsb2NrZWQgb24gZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG5cbiAgaXQgQCAnZXhlcmNpc2UgZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICBsZXQgdiA9ICdhJ1xuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYScpXG5cbiAgICBjb25zdCBwID0gQCE+XG4gICAgICB2ID0gJ2InXG5cbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdiYicpXG5cbiAgICAgIHYgPSAnYydcbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdjYycpXG4gICAgICB2ID0gJ2QnXG4gICAgICByZXR1cm4gMTk0MlxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnZCcpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfZm59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5XG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9mbicsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9mbigpXG5cbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGlzX2ZlbmNlX2NvcmUocmVzWzBdKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSBmZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LCBcbiAgaXNfZmVuY2VfY29yZSxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vYmonLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG4gICAgZXhwZWN0KHJlcy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMucmVzdW1lKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hYm9ydCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXNfZmVuY2VfY29yZSBAIHJlc1xuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2RlZmVyX3doZW4sIGFvX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fd2hlbiBhbmQgYW9fZGVmZXJfd2hlbicsIEA6OlxuXG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgZXhwZWN0KGFvX3doZW4pLnRvLmVxdWFsKGFvX2RlZmVyX3doZW4pXG5cbiAgICBjb25zdCByZXMgPSBhb193aGVuKClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICBleHBlY3QocmVzLmhhcykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZ2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlbGV0ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVmaW5lKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnd2hlbiBtYXAtbGlrZSB3aXRoIGRlZmVycmVkIHByb21pc2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3doZW4oKVxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfc2V0ID0gcmVzLnNldCgnc29tZS1rZXknLCAnc29tZS12YWx1ZScpXG4gICAgZXhwZWN0KHBfc2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KHBfc2V0KS50by5lcXVhbChwX2dldClcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ3NvbWUtdmFsdWUnKVxuXG4gIGl0IEAgJ3doZW4gZGVmZXJlZCBtdWx0aXBsZSBzZXQnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fd2hlbigpXG4gICAgbGV0IHBfZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIGxldCBwX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcblxuICAgIC8vIGV4cGVjdCBmaXJzdCB2YWx1ZVxuICAgIGV4cGVjdChhd2FpdCBwX3NldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIC8vIGV4cGVjdCBmaXJzdCB2YWx1ZVxuICAgIGV4cGVjdChhd2FpdCByZXMuZ2V0KCdzb21lLWtleScpKS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX3RyYWNrX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX3RyYWNrX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3doZW4oKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgIGV4cGVjdChyZXMuaGFzKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVsZXRlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWZpbmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICd3aGVuIG1hcC1saWtlIHdpdGggZmVuY2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3doZW4oKVxuXG4gICAgbGV0IHBfZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIGV4cGVjdChwX2dldCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9zZXQgPSByZXMuc2V0KCdzb21lLWtleScsICdzb21lLXZhbHVlJylcbiAgICBleHBlY3QocF9zZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgLy8gZXhwZWN0IHNhbWUgdmFsdWVcbiAgICBleHBlY3QocF9zZXQpLnRvLmVxdWFsKHBfZ2V0KVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnc29tZS12YWx1ZScpXG5cblxuICBpdCBAICd3aGVuIHRyYWNrIGNoYW5nZWQnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fdHJhY2tfd2hlbigpXG5cbiAgICBsZXQgcF9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIGxldCBwX2dldF9wcmUgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnYW5vdGhlci12YWx1ZScpXG4gICAgbGV0IHBfZ2V0X3Bvc3QgPSByZXMuZ2V0KCdzb21lLWtleScpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0X3ByZSkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfcG9zdCkudG8uZXF1YWwoJ2Fub3RoZXItdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgIGV4cGVjdChyZXMuaGFzKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVsZXRlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWZpbmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICd3aGVuIG1hcC1saWtlIHdpdGggZmVuY2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuICAgIGxldCBmbl9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KGZuX2dldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgbGV0IHBfZ2V0ID0gZm5fZ2V0KClcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IGZuX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChmbl9zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KGZuX3NldCkudG8uZXF1YWwoZm5fZ2V0KVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnc29tZS12YWx1ZScpXG5cblxuICBpdCBAICd3aGVuIGZlbmNlIHJlc2V0JywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuXG4gICAgbGV0IGZuX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcblxuICAgIGxldCBwX2dldCA9IGZuX2dldCgpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIGxldCBwX2dldF8yID0gZm5fZ2V0KCkgLy8gcmVzZXRcbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfMikudG8uZXF1YWwoJ2Fub3RoZXItdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX291dCwgYW9faXRlciwgYW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsXG4gIGlzX2ZlbmNlX2NvcmUsXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vdXQnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX291dCgpXG4gICAgZXhwZWN0KHJlcy5hb19ib3VuZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5iaW5kX2dhdGVkKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hbGxvd19tYW55KS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdjaGVjayBub3QgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXNzZXJ0LmZhaWwgQCAnc2hvdWxkIGhhdmUgcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgY2F0Y2ggZXJyIDo6XG4gICAgICBpZiAvYW9fZmVuY2Vfb3V0IG5vdCBib3VuZC8udGVzdChlcnIubWVzc2FnZSkgOjpcbiAgICAgICAgLy8gd29ya2VkXG4gICAgICBlbHNlIHRocm93IGVyclxuXG5cbiAgaXQgQCAnY2hlY2sgYWxyZWFkeSBib3VuZCBlcnJvcicsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcblxuICAgIHRyeSA6OlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBjb25zdW1lZDsvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuICBpdCBAICdhbGxvd19tYW55KCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX2ZvcmsoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICBpdCBAICdhb19ib3VuZCgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19ib3VuZCgpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fcnVuKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBsZXQgcCA9IGYuYW9fcnVuKClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgZXhwZWN0KGYud2hlbl9ydW4pLnRvLmVxdWFsKHApXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZmVuY2VfZ2VuLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4nLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9nZW4gQCBhb19mZW5jZV9pbigpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fZm9sZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfc2luaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19mb2xkKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2l0ZXIsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfc2luaywgYW9fZmVuY2VfaXRlciwgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX2JhcmUnLCBmdW5jdGlvbigpIDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2Vfc2luaygpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGlzX2dlbihzb21lX3F1ZXVlLmdfaW4pXG4gICAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuICAgIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuICAgICAgbGV0IHNlY29uZF9xdWV1ZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3F1ZXVlIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc2Vjb25kX3F1ZXVlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICAgIGZpcnN0X3F1ZXVlLmdfaW5cblxuICAgICAgYXdhaXQgZmlyc3RfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2l0ZXIoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2VfaXRlcigpXG5cbiAgICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3BpcGUgPSBhb19mZW5jZV9pdGVyKClcbiAgICAgIGxldCBzZWNvbmRfcGlwZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3BpcGUgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgICAgc2Vjb25kX3BpcGUuZ19pbiA9IGZpcnN0X3BpcGUuZ19pblxuXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc2Vjb25kX3BpcGUsXG4gICAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19wdXNoX3N0cmVhbSwgYXNfaXRlcl9wcm90bywgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX3N0cmVhbScsIGZ1bmN0aW9uKCkgOjpcblxuICBkZXNjcmliZSBAICdhb19wdXNoX3N0cmVhbSgpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9zdHJlYW0gPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgZXhwZWN0KHNvbWVfc3RyZWFtLmdfaW4pLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3N0cmVhbSA9IGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9zdHJlYW0pLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIHNvbWVfc3RyZWFtLnB1c2ggQCAnZmlyc3QnXG4gICAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5kZWVwLmVxdWFsIEA6XG4gICAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG5cbiAgICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgICBsZXQgZmlyc3Rfc3RyZWFtID0gYW9fcHVzaF9zdHJlYW0oKVxuXG4gICAgICBsZXQgc2Vjb25kX3N0cmVhbSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3N0cmVhbSA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNlY29uZF9zdHJlYW0pXG5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMCA6OlxuICAgICAgICBmaXJzdF9zdHJlYW0ucHVzaCh2KVxuXG4gICAgICBmaXJzdF9zdHJlYW0uYWJvcnQoKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyX2ZlbmNlZCwgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fZGVib3VuY2UnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2RlYm91bmNlKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICBleHBlY3QoYW90LndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LndoZW5fcnVuXG5cblxuICBpdCBAICdhb19pdGVyX2ZlbmNlZCB3aXRoIGFvX2ludGVydmFsIGFzIHJhdGUgbGltaXQnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQFxuICAgICAgYW9faXRlcl9mZW5jZWQgQFxuICAgICAgICBbMzAsIDIwLCAxMCwgMTVdXG4gICAgICAgIGFvX2ludGVydmFsKDEwKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGV4cGVjdCh2YWx1ZSkudG8uZXF1YWwoMzApXG5cbiAgICBsZXQgbHN0ID0gW3ZhbHVlXVxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KGxzdCkudG8uZGVlcC5lcXVhbCBAXG4gICAgICBbMzAsIDIwLCAxMCwgMTVdXG5cblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogW3RzMV19ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICBsZXQge3ZhbHVlOiBbdHMyXX0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9hbmltYXRpb24sIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBhbmltYXRpb24gZnJhbWVzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fYW5pbWF0aW9uXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgOjpcblxuICAgIGl0IEAgJ2FvX2RvbV9hbmltYXRpb24nLCBAOjo+XG4gICAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fYW5pbWF0aW9uKClcbiAgICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHZhbHVlID49IDApXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuXG4gICAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9fZG9tX2FuaW1hdGlvbigpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2xpc3Rlbn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXksXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGFycmF5X2Zyb21fYW9faXRlclxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBldmVudHMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9saXN0ZW5cblxuICAgIGxldCBkZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2xpc3RlbigpXG4gICAgaXNfZ2VuIEAgZGUuZ19pblxuICAgIGlzX2ZuIEAgZGUud2l0aF9kb21cblxuXG4gIGl0IEAgJ3NoYXBlIG9mIHdpdGhfZG9tJywgQDo6XG4gICAgbGV0IG1vY2sgPSBAe31cbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZ0LCBmbiwgb3B0KSA6OlxuXG4gICAgbGV0IGVfY3R4ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICAud2l0aF9kb20obW9jaylcblxuICAgIGlzX2ZuIEAgZV9jdHgud2l0aF9kb21cbiAgICBpc19mbiBAIGVfY3R4Lmxpc3RlblxuXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA6OlxuXG4gICAgaXQgQCAnbWVzc2FnZSBjaGFubmVscycsIEA6Oj5cbiAgICAgIGNvbnN0IHtwb3J0MSwgcG9ydDJ9ID0gbmV3IE1lc3NhZ2VDaGFubmVsKClcblxuICAgICAgY29uc3QgYW9fdGd0ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihhb190Z3QpXG5cbiAgICAgIGFvX3RndFxuICAgICAgICAud2l0aF9kb20gQCBwb3J0Miwgdm9pZCBwb3J0Mi5zdGFydCgpXG4gICAgICAgIC5saXN0ZW4gQCAnbWVzc2FnZScsIGV2dCA9PiBAOiB0ZXN0X25hbWU6IGV2dC5kYXRhXG5cbiAgICAgIDo6IT5cbiAgICAgICAgZm9yIGxldCBtIG9mIFsnYScsICdiJywgJ2MnXSA6OlxuICAgICAgICAgIHBvcnQxLnBvc3RNZXNzYWdlIEAgYGZyb20gbXNnIHBvcnQxOiAke219YFxuICAgICAgICAgIGF3YWl0IGRlbGF5KDEpXG5cbiAgICAgICAgYW9fdGd0LmdfaW4ucmV0dXJuKClcbiAgICAgICAgcG9ydDEuY2xvc2UoKVxuXG4gICAgICBsZXQgZXhwZWN0ZWQgPSBAW11cbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBhJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGInXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYydcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwoZXhwZWN0ZWQpXG5cbiJdLCJuYW1lcyI6WyJhb193aGVuIl0sIm1hcHBpbmdzIjoiOzs7RUFBQSxNQUFBLEVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxHQUFBLE9BQUEsQ0FBbUMsTUFBTSxFQUFBOztFQUd6QyxNQUFBLEtBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBO0lBQ0UsSUFBYSxPQUFBLENBQUEsQ0FBQTtFQUNYLElBQUEsVUFBQSxDQUFZLENBQVEsRUFBQSxFQUFBLEVBQUEsU0FBQSxDQUFBLEdBQUE7O0VBRXhCLE1BQUEsVUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBO0lBQ0UsT0FBZSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsRUFBQTs7RUFFakIsaUJBQUEsVUFBQSxDQUFBLElBQUEsRUFBQSxFQUFBLENBQUEsQ0FBQSxFQUFBO0VBQ0UsRUFBQSxNQUFBLEtBQUEsQ0FBQSxFQUFBLEVBQUE7RUFDUyxFQUFBLFdBQUEsSUFBQSxDQUFBLElBQUEsSUFBQSxFQUFBO0VBQ1AsSUFBQSxNQUFBLEVBQUE7RUFDQSxJQUFBLE1BQUEsS0FBQSxDQUFBLEVBQUEsRUFBQSxDQUFBLEVBQUE7O0VBRUosU0FBQSxLQUFBLENBQUEsRUFBQSxFQUFBO0VBQ0UsRUFBQSxNQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQW1CLFVBQVUsRUFBQTtFQUM3QixFQUFBLE9BQUEsRUFBQSxDQUFBOztFQUVGLFNBQUEsTUFBQSxDQUFBLENBQUEsRUFBQTtFQUNFLEVBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLEVBQUE7RUFDQSxFQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxFQUFBO0VBQ0EsRUFBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsRUFBQTtFQUNBLEVBQUEsT0FBQSxDQUFBLENBQUE7O0VBRUYsU0FBQSxhQUFBLENBQUEsQ0FBQSxFQUFBO0VBQ0UsRUFBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsRUFBQTtFQUNBLEVBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLEVBQUE7RUFDQSxFQUFBLGlCQUFBLENBQUEsQ0FBQSxFQUFBOztFQUVBLEVBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxhQUFBLEVBQUE7O0VBRUEsRUFBQSxPQUFBLENBQUEsQ0FBQTs7RUFFRixTQUFBLFlBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDRSxFQUFBLGFBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDQSxFQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxFQUFBO0VBQ0EsRUFBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTs7RUFFQSxFQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUE7RUFDQSxFQUFBLE9BQUEsQ0FBQSxDQUFBOztFQUVGLFNBQUEsaUJBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDRSxFQUFBLE1BQUEsQ0FBUSxJQUFrQyxJQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsYUFBQSxDQUFBLEVBQUEsZ0JBQUEsRUFBQTtFQUMxQyxFQUFBLE9BQUEsQ0FBQSxDQUFBOztFQUVGLGVBQUEsa0JBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDRSxFQUFBLElBQUEsR0FBQSxHQUFBLEdBQUE7RUFDUyxFQUFBLFdBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQSxFQUFBO0VBQ1AsSUFBQSxHQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBO0VBQ0YsRUFBQSxPQUFBLEdBQUE7O0VDbkRGLE1BQU0sVUFBVSxHQUFHLENBQUM7RUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztFQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7RUFDckIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0VBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUI7QUFDQTtFQUNBLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUMvQyxNQUFNLGFBQWEsR0FBRyxHQUFHLElBQUk7RUFDN0IsRUFBRSxJQUFJLEdBQUcsS0FBSyxPQUFPLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRTtFQUM5QyxJQUFJLE1BQU0sR0FBRyxDQUFDO0VBQ2QsRUFBRSxPQUFPLElBQUksQ0FBQyxDQUFDO0FBQ2Y7QUFDQTtFQUNBLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNO0VBQ2hDLEVBQUUsU0FBUyxLQUFLLElBQUksR0FBRyxNQUFNO0VBQzdCLElBQUksTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJO0VBQ3RCLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQztBQUNkO0VBQ0EsU0FBUyxXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEdBQUcsRUFBRSxFQUFFLGNBQWMsRUFBRTtFQUM1RCxFQUFFLElBQUksT0FBTyxHQUFHLGNBQWMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3ZDLEVBQUUsT0FBTztFQUNULElBQUksR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUN2QixJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN0QixJQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTTtFQUN2QixJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUU7RUFDZCxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQzNCLE1BQU0sSUFBSSxDQUFDLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFO0VBQ2pDLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNyQixRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUU7RUFDdkIsTUFBTSxPQUFPLENBQUMsQ0FBQztFQUNmLElBQUksS0FBSyxHQUFHO0VBQ1o7RUFDQSxNQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7RUFDNUIsTUFBTSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtFQUNqQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUM3QjtFQUNBLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQjtFQUNBLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFO0VBQ2pCLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN0QixJQUFJLElBQUksU0FBUyxLQUFLLENBQUMsRUFBRTtFQUN6QixNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDOUIsSUFBSSxPQUFPLENBQUMsQ0FBQztBQUNiO0VBQ0EsRUFBRSxTQUFTLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0VBQ3hCLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRSxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEMsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDbEIsSUFBSSxPQUFPLENBQUMsRUFBRSxFQUFFO0FBQ2hCO0VBQ0EsU0FBUyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJLEtBQUssSUFBSSxFQUFFO0VBQ2xEO0VBQ0EsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7RUFDekMsRUFBRSxPQUFPLENBQUM7RUFDVjtFQUNBLElBQUksQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQztFQUMxQixJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEI7RUFDQSxNQUFNLFVBQVU7RUFDaEIsRUFBRSxZQUFZLEVBQUUsQ0FBQztBQUNqQjtFQUNBLE1BQU0sVUFBVTtFQUNoQixFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNyQixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0M7RUFDQSxNQUFNLGFBQWEsR0FBRyxFQUFFO0VBQ3hCLEVBQUUsV0FBVyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM5QjtFQUNBLGVBQWUsTUFBTSxDQUFDLE1BQU0sRUFBRTtFQUM5QixFQUFFLFdBQVcsSUFBSSxDQUFDLElBQUksTUFBTSxFQUFFLEVBQUUsRUFBRTtBQUNsQztBQUNBO0VBQ0EsZUFBZSxRQUFRLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUU7RUFDcEQsRUFBRSxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtFQUN6QixJQUFJLE9BQU8sR0FBRyxPQUFPLEVBQUUsQ0FBQztFQUN4QixJQUFJLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQ3BCO0VBQ0EsRUFBRSxXQUFXLElBQUksQ0FBQyxJQUFJLE1BQU0sRUFBRTtFQUM5QixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDdkMsSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQ3ZCO0VBQ0EsRUFBRSxJQUFJLFNBQVMsRUFBRTtFQUNqQixJQUFJLE1BQU0sT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRTtBQUM5QjtBQUNBO0FBQ0E7RUFDQSxXQUFXLElBQUksQ0FBQyxRQUFRLEVBQUU7RUFDMUIsRUFBRSxRQUFRLFFBQVEsUUFBUSxDQUFDLENBQUM7QUFDNUI7RUFDQSxTQUFTLFlBQVksQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0VBQ3pDLEVBQUUsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztFQUMvQixFQUFFLE9BQU87RUFDVCxJQUFJLFNBQVMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHO0VBQ3JDLE1BQU0sR0FBRztFQUNULFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztFQUNsRCxRQUFRLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLENBQUM7RUFDaEMsUUFBUSxNQUFNLEtBQUssQ0FBQyxDQUFDO0VBQ3JCLGFBQWEsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFO0FBQzNCO0FBQ0E7RUFDQSxTQUFTLFNBQVMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFO0VBQ3RDLEVBQUUsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztFQUM1QixFQUFFLE9BQU87RUFDVCxJQUFJLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHO0VBQ3pCLE1BQU0sR0FBRztFQUNULFFBQVEsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7RUFDNUMsUUFBUSxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxDQUFDO0VBQ2hDLFFBQVEsTUFBTSxLQUFLLENBQUMsQ0FBQztFQUNyQixhQUFhLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRTtBQUMzQjtBQUNBO0VBQ0EsaUJBQWlCLE9BQU8sQ0FBQyxRQUFRLEVBQUU7RUFDbkMsRUFBRSxRQUFRLFFBQVEsUUFBUSxDQUFDLENBQUM7QUFDNUI7QUFDQTtFQUNBLGlCQUFpQixlQUFlLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFO0VBQ2xFLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDO0VBQ3RELEVBQUUsV0FBVyxJQUFJLENBQUMsSUFBSSxRQUFRLEVBQUU7RUFDaEMsSUFBSSxNQUFNLENBQUMsQ0FBQztFQUNaLElBQUksTUFBTSxDQUFDLENBQUM7RUFDWixJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQzFCO0FBQ0E7RUFDQSxNQUFNLGNBQWMsR0FBRyxDQUFDLEdBQUcsSUFBSTtFQUMvQixFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUM5QztFQUNBLFNBQVMsVUFBVSxDQUFDLEtBQUssRUFBRTtFQUMzQixFQUFFLElBQUksQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDO0VBQ3ZCLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxLQUFLO0VBQzFCLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUM3QztFQUNBLFNBQVMsVUFBVSxHQUFHO0VBQ3RCLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNiO0VBQ0EsRUFBRSxJQUFJLEtBQUssSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO0VBQzNEO0VBQ0EsRUFBRSxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0VBQ3hEO0VBQ0EsRUFBRSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztFQUNuRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFO0FBQ2pDO0FBQ0E7RUFDQSxNQUFNLGFBQWEsR0FBRyxFQUFFO0VBQ3hCLEVBQUUsV0FBVyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUM5QjtFQUNBLGlCQUFpQixhQUFhLENBQUMsS0FBSyxFQUFFO0VBQ3RDLEVBQUUsSUFBSTtFQUNOLElBQUksT0FBTyxDQUFDLEVBQUU7RUFDZCxNQUFNLElBQUksQ0FBQyxHQUFHLE1BQU0sS0FBSyxFQUFFLENBQUM7RUFDNUIsTUFBTSxJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUU7RUFDM0IsUUFBUSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtFQUNyQixFQUFFLE9BQU8sR0FBRyxFQUFFO0VBQ2QsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFCO0FBQ0E7QUFDQTtFQUNBLE1BQU0sbUJBQW1CLEdBQUc7RUFDNUIsRUFBRSxhQUFhO0FBQ2Y7RUFDQTtFQUNBLEVBQUUsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUc7RUFDM0IsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUMxQjtFQUNBLEVBQUUsT0FBTyxHQUFHO0VBQ1osSUFBSSxJQUFJLEVBQUUsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQ3ZDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztFQUN2QixJQUFJLE9BQU8sS0FBSyxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQ3JDO0FBQ0E7RUFDQSxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUU7RUFDMUIsRUFBRSxJQUFJLENBQUMsR0FBRyxVQUFVLEVBQUUsQ0FBQztFQUN2QixFQUFFLElBQUksU0FBUyxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN0QyxFQUFFLEdBQUcsQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztFQUN0RCxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ1g7QUFDQTtFQUNBLE1BQU0sWUFBWSxHQUFHO0VBQ3JCLEVBQUUsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFRbEM7RUFDQSxTQUFTLFFBQVEsQ0FBQyxRQUFRLEVBQUU7RUFDNUIsRUFBRSxJQUFJLEtBQUssR0FBRyxZQUFZLEVBQUUsQ0FBQztFQUM3QixFQUFFLEtBQUssQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQztFQUM1QyxFQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztFQUM3QixFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQ2Y7RUFDQSxlQUFlLE9BQU8sQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFO0VBQ3hDLEVBQUUsSUFBSTtFQUNOLElBQUksV0FBVyxJQUFJLENBQUMsSUFBSSxRQUFRLEVBQUU7RUFDbEMsTUFBTSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUN6QjtFQUNBLEVBQUUsT0FBTyxHQUFHLEVBQUU7RUFDZCxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3hCO0VBQ0EsVUFBVTtFQUNWLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNyQjtBQUNBO0VBQ0EsU0FBUyxNQUFNLENBQUMsUUFBUSxFQUFFO0VBQzFCLEVBQUUsSUFBSSxLQUFLLEdBQUcsWUFBWSxFQUFFLENBQUM7RUFDN0IsRUFBRSxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO0VBQ3hDLEVBQUUsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztFQUN0QyxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0VBQzNDLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztBQUN6QjtFQUNBLGlCQUFpQixPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRTtFQUMxQyxFQUFFLElBQUk7RUFDTixJQUFJLFdBQVcsSUFBSSxDQUFDLElBQUksUUFBUSxFQUFFO0VBQ2xDLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUN0QixNQUFNLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNqQjtFQUNBLEVBQUUsT0FBTyxHQUFHLEVBQUU7RUFDZCxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3hCO0VBQ0EsVUFBVTtFQUNWLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNyQjtFQUNBLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUU7RUFDbEMsRUFBRSxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7RUFDOUIsRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUs7RUFDMUIsSUFBSSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ25CLElBQUksTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEIsSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNmLElBQUksS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDZixJQUFJLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3ZCO0VBQ0EsU0FBUyxVQUFVLENBQUMsT0FBTyxHQUFHLElBQUksVUFBVSxFQUFFLEVBQUU7RUFDaEQ7RUFDQSxFQUFFLElBQUksQ0FBQyxDQUFDO0VBQ1IsRUFBRSxJQUFJLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNsQjtFQUNBLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDUjtFQUNBLEVBQUUsSUFBSSxLQUFLLEdBQUcsR0FBRztFQUNqQixJQUFJLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUMxQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUM3QztFQUNBO0VBQ0EsRUFBRSxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNwQztFQUNBO0VBQ0EsRUFBRSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUM7QUFDL0M7RUFDQTtFQUNBLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNuRDtFQUNBLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtFQUNyQjtFQUNBO0VBQ0EsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3QixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEIsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ2Q7QUFDQTtFQUNBLE1BQU0sYUFBYSxHQUFHLEVBQUU7RUFDeEIsRUFBRSxXQUFXLENBQUMsVUFBVSxFQUFFLEVBQUUs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LENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQXFCLFFBQVEsRUFBQTtFQUM3QixNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTRCLFNBQVMsRUFBQTtFQUNyQyxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTRCLFVBQVUsRUFBQTtFQUN0QyxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTJCLFVBQVUsRUFBQSxDQUFBLElBQUE7O0VBRXZDLElBQUEsRUFBQSxDQUFJLGNBQWUsR0FBQSxZQUFBO0VBQ2pCLE1BQUEsTUFBQSxHQUFBLEdBQUEsVUFBQSxHQUFBO0VBQ0EsTUFBQSxJQUFBLENBQUEsR0FBQSxHQUFBLENBQUEsUUFBQTs7RUFFQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQWMsU0FBVSxFQUFBLE1BQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTs7RUFFeEIsTUFBQSxHQUFBLENBQUEsT0FBQSxDQUFZLEtBQUssRUFBQTtFQUNqQixNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQWMsS0FBTSxFQUFBLE1BQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxFQUFBLElBQUE7O0VBRXRCLElBQUEsRUFBQSxDQUFJLGFBQWMsR0FBQSxZQUFBO0VBQ2hCLE1BQUEsTUFBQSxHQUFBLEdBQUEsVUFBQSxHQUFBO0VBQ0EsTUFBQSxJQUFBLENBQUEsR0FBQSxHQUFBLENBQUEsUUFBQTs7RUFFQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQWMsU0FBVSxFQUFBLE1BQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTs7RUFFeEIsTUFBQSxHQUFBLENBQUEsTUFBQSxDQUFZLFVBQVcsTUFBTSxDQUFBLEVBQUE7O0VBRTdCLE1BQUEsSUFBQTtFQUNFLFFBQUEsTUFBQSxFQUFBO0VBQ0EsUUFBQSxNQUFBLENBQUEsSUFBQSxHQUFBLENBQUE7RUFDRyxNQUFBLE9BQUEsR0FBQSxFQUFBO0VBQ0gsUUFBQSxNQUFBLENBQUEsS0FBQSxDQUFjLE1BQU8sRUFBQSxHQUFBLENBQUEsT0FBQSxFQUFBLEVBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxFQUFBOztFQzdEN0IsUUFBQSxDQUFVLFlBQWEsR0FBQSxNQUFBOztFQUVyQixFQUFBLEVBQUEsQ0FBSSxRQUFTLEdBQUEsWUFBQTtNQUNYLElBQXFCLENBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQSxJQUFBLEVBQUEsSUFBQSxFQUFBLElBQUEsQ0FBQSxFQUFBO0VBQ3JCLElBQUEsSUFBQSxDQUFBLEdBQUEsTUFBQSxDQUFBLENBQUEsRUFBQTs7RUFFQSxJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBO01BQzNCLE1BQWtCLENBQUEsU0FBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLFNBQUEsRUFBQSxFQUFBLElBQUE7O0VBRXBCLEVBQUEsRUFBQSxDQUFJLG9CQUFxQixHQUFBLFlBQUE7RUFDdkIsSUFBQSxJQUFBLEdBQUEsR0FBQSxHQUFBO0VBQ0EsSUFBQSxJQUFBLEtBQUEsR0FBQSxRQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsSUFBQSxLQUFBLENBQUEsSUFBQSxDQUFXLE9BQU8sRUFBQTtFQUNsQixJQUFBLEtBQUEsQ0FBQSxJQUFBLENBQVcsUUFBUSxFQUFBO01BQ25CLElBQXFCLENBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQSxJQUFBLEVBQUEsSUFBQSxFQUFBLElBQUEsQ0FBQSxFQUFBO01BQ3JCLElBQWtCLENBQUEsR0FBQSxRQUFBLENBQUEsQ0FBQSxFQUFBLEtBQUEsRUFBQTs7RUFFbEIsSUFBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQWtCLFNBQVMsRUFBQTtNQUMzQixNQUFrQixDQUFBLFNBQUEsQ0FBQSxNQUFBLENBQUEsRUFBQSxTQUFBLEVBQUE7RUFDbEIsSUFBQSxLQUFBLENBQUEsSUFBQSxDQUFXLE9BQU8sRUFBQTs7TUFFbEIsTUFBa0IsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBO0VBQ2hCLE1BQUEsUUFBQTtFQUNBLE1BQUEsSUFBQTtFQUNBLE1BQUEsSUFBQTtFQUNBLE1BQUEsSUFBQTtFQUNBLE1BQUEsT0FBQSxDQUFBLEdBQUE7O0VBRUYsSUFBQSxXQUFBLFFBQUEsQ0FBQSxHQUFBLEVBQUE7RUFDTyxNQUFBLE9BQUEsQ0FBQSxFQUFBO0VBQ0gsUUFBQSxJQUFBLENBQUEsR0FBQSxNQUFBO0VBQ0EsUUFBQSxHQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsRUFBQSxJQUFBOztFQUVOLEVBQUEsRUFBQSxDQUFJLG1CQUFvQixHQUFBLFlBQUE7RUFDdEIsSUFBQSxJQUFBLEdBQUEsR0FBQSxHQUFBO01BQ0EsSUFBcUIsQ0FBQSxHQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxDQUFBLEVBQUE7TUFDckIsSUFBa0IsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBLEVBQUEsUUFBQSxFQUFBOztFQUVsQixJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBO01BQzNCLE1BQWtCLENBQUEsU0FBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLFNBQUEsRUFBQTs7TUFFbEIsTUFBa0IsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBO0VBQ2hCLE1BQUEsSUFBQTtFQUNBLE1BQUEsSUFBQTtFQUNBLE1BQUEsSUFBQSxDQUFBLEdBQUE7O0VBRUYsSUFBQSxXQUFBLFFBQUEsR0FBQTtFQUNPLE1BQUEsT0FBQSxDQUFBLEVBQUE7RUFDSCxRQUFBLElBQUEsQ0FBQSxHQUFBLE1BQUE7RUFDQSxRQUFBLEdBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxFQUFBLElBQUEsRUFBQTs7RUMvQ1IsUUFBQSxDQUFVLGtCQUFtQixHQUFBLE1BQUE7O0VBRTNCLEVBQUEsRUFBQSxDQUFJLGFBQWMsR0FBQSxNQUFBO0VBQ2hCLElBQUEsSUFBQSxDQUFBLEdBQUEsTUFBQSxDQUFnQixJQUFRLENBQUEsQ0FBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUE7TUFDeEIsTUFBa0IsQ0FBQSxTQUFBLENBQUEsQ0FBQSxLQUFBLEVBQUEsRUFBQSxFQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsSUFBQSxFQUFBLEVBQUEsRUFBQSxJQUFBOzs7RUFHcEIsRUFBQSxFQUFBLENBQUksWUFBYSxHQUFBLFlBQUE7RUFDZixJQUFBLElBQUEsQ0FBQSxHQUFBLE1BQUEsQ0FBZ0IsT0FBVyxDQUFBLENBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLENBQUEsQ0FBQSxFQUFBOztFQUUzQixJQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxJQUFBLEdBQUE7RUFDQSxJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBOztNQUUzQixNQUFrQixDQUFBLFNBQUEsQ0FBQSxDQUFBLEtBQUEsRUFBQSxFQUFBLEVBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLE1BQUEsQ0FBQSxFQUFBLEVBQUEsSUFBQTs7O0VBR3BCLEVBQUEsRUFBQSxDQUFJLGtCQUFtQixHQUFBLE1BQUE7RUFDckIsSUFBQSxJQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsSUFBQTtFQUNFLE1BQUEsR0FBQTtFQUNFLFFBQUEsQ0FBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsQ0FBQTtFQUNBLFFBQUEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQSxDQUFBLEdBQUE7O01BRWxCLE1BQWtCLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNoQixNQUFBLENBQUEsRUFBQSxFQUFLLEdBQUcsQ0FBQTtFQUNSLE1BQUEsQ0FBQSxFQUFBLEVBQUssR0FBRyxDQUFBO0VBQ1IsTUFBQSxDQUFBLEVBQUEsRUFBSyxHQUFHLENBQUEsQ0FBQSxHQUFBOztFQUVWLElBQUEsV0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQTtFQUNFLE1BQUEsQ0FBQSxHQUFBLFNBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDRyxNQUFBLEtBQUEsSUFBQSxFQUFBLElBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO0VBQ0UsUUFBQSxLQUFBLElBQUEsRUFBQSxJQUFBLENBQUEsRUFBQTtFQUNELFVBQUEsTUFBQSxDQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUEsRUFBQSxJQUFBOzs7RUFHUixFQUFBLEVBQUEsQ0FBSSxvQkFBcUIsR0FBQSxZQUFBO0VBQ3ZCLElBQUEsSUFBQSxDQUFBLEdBQUEsTUFBQSxrQkFBQTtFQUNFLE1BQUEsTUFBQTtFQUNFLFFBQUEsQ0FBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsQ0FBQTtFQUNBLFFBQUEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQSxDQUFBLEdBQUE7O01BRWxCLE1BQWtCLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNoQixNQUFBLENBQUEsRUFBQSxFQUFLLEdBQUcsQ0FBQTtFQUNSLE1BQUEsQ0FBQSxFQUFBLEVBQUssR0FBRyxDQUFBO0VBQ1IsTUFBQSxDQUFBLEVBQUEsRUFBSyxHQUFHLENBQUEsQ0FBQSxHQUFBOzs7RUFHVixJQUFBLGlCQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBO0VBQ0UsTUFBQSxDQUFBLEdBQUEsWUFBQSxDQUFBLENBQUEsRUFBQTtFQUNTLE1BQUEsV0FBQSxJQUFBLEVBQUEsSUFBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDRSxRQUFBLFdBQUEsSUFBQSxFQUFBLElBQUEsQ0FBQSxFQUFBO0VBQ1AsVUFBQSxNQUFB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QSxFQUFBO1FBQ0EsaUJBQW1CLENBQUEsS0FBQSxFQUFBO1FBQ25CLE1BQVEsQ0FBQSxNQUFBLEVBQUE7O0VBRVIsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUE0QixVQUFVLEVBQUE7O0VBRXRDLE1BQUEsSUFBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFrQixTQUFTLEVBQUE7O0VBRTNCLE1BQUEsSUFBQSxDQUFBLEdBQUEsa0JBQUEsQ0FBQSxLQUFBLENBQUEsT0FBQSxFQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBO0VBQzNCLE1BQUEsSUFBQSxDQUFBLEdBQUEsa0JBQUEsQ0FBQSxLQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBO0VBQzNCLE1BQUEsSUFBQSxDQUFBLEdBQUEsa0JBQUEsQ0FBQSxLQUFBLENBQUEsT0FBQSxFQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBOztFQUUzQixNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQWMsU0FBVSxFQUFBLE1BQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtFQUN4QixNQUFBLGtCQUFBLENBQUEsTUFBQSxFQUFBOztFQUVBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLENBQUEsRUFBQSxJQUFBLEVBQUE7O0VBRUEsTUFBQSxNQUFBLENBQUEsU0FBQSxDQUFrQixDQUFpQixHQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLENBQUEsRUFBQTtFQUNuQyxNQUFBLE1BQUEsQ0FBQSxTQUFBLENBQWtCLENBQWlCLEdBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLEVBQUEsSUFBQSxFQUFBLElBQUEsQ0FBQSxFQUFBO0VBQ25DLE1BQUEsTUFBQSxDQUFBLFNBQUEsQ0FBa0IsQ0FBaUIsR0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxDQUFBLEVBQUE7O1FBRW5DLE1BQVEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxFQUFBO1FBQ1IsTUFBUSxDQUFBLENBQUEsS0FBQSxDQUFBLEVBQUE7UUFDUixNQUFRLENBQUEsQ0FBQSxLQUFBLENBQUEsRUFBQSxFQUFBLElBQUEsRUFBQTs7RUN0RWQsUUFBQSxDQUFVLFVBQVcsR0FBQSxNQUFBOztFQUVuQixFQUFBLFFBQUEsQ0FBVSxrQkFBbUIsR0FBQSxNQUFBO0VBQzNCLElBQUEsRUFBQSxDQUFJLE9BQVEsR0FBQSxNQUFBO0VBQ1YsTUFBQSxNQUFBLEdBQUEsR0FBQSxVQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBcUIsT0FBTyxFQUFBO0VBQzVCLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUF1QixTQUFTLEVBQUE7RUFDaEMsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXVCLFVBQVUsRUFBQTtFQUNqQyxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBdUIsVUFBVSxFQUFBO0VBQ2pDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUF1QixVQUFVLEVBQUE7RUFDakMsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXVCLFNBQVMsRUFBQTs7O0VBR2hDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsSUFBQTs7RUFFRixJQUFBLEVBQUEsQ0FBSSxlQUFnQixHQUFBLFlBQUE7RUFDbEIsTUFBQSxNQUFBLEVBQUEsR0FBQSxVQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxJQUFBLEVBQUEsTUFBQSxFQUFBLEtBQUEsRUFBQSxLQUFBLENBQUEsR0FBQSxHQUFBOzs7RUFHQSxNQUFBLElBQUEsR0FBQSxHQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBO0VBQ0EsTUFBQSxJQUFBLEdBQUEsR0FBQSxLQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBOztFQUVBLE1BQUEsTUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxFQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBOztFQUVBLE1BQUEsSUFBQSxHQUFBLEdBQUEsS0FBQSxHQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxJQUFBLEdBQUEsR0FBQSxLQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxNQUFBLE1BQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxJQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBOztFQUVBLE1BQUEsSUFBQSxHQUFBLEdBQUEsS0FBQSxHQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBOztFQUVBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7O0VBRUEsTUFBQSxNQUFBLENBQUEsTUFBQSxJQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxFQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsRUFBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQSxJQUFBOzs7RUFHRixJQUFBLEVBQUEsQ0FBSSwwQkFBMkIsR0FBQSxZQUFBO0VBQzdCLE1BQUEsTUFBQSxDQUFBLElBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQSxFQUFBLEtBQUEsQ0FBQSxHQUFBLFVBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEVBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUEsR0FBQSxHQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFvQixTQUFTLEVBQUE7RUFDN0IsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBOztFQUVBLE1BQUEsSUFBQSxHQUFBLEdBQUEsS0FBQSxHQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQW9CLFNBQVMsRUFBQTtFQUM3QixNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxNQUFBLE1BQUEsQ0FBQSxJQUFBLEVBQUE7O0VBRUEsTUFBQSxNQUFBLENBQUEsTUFBQSxJQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBLENBQUEsSUFBQTs7RUFFRixJQUFBLEVBQUEsQ0FBSSx5QkFBMEIsR0FBQSxZQUFBO0VBQzVCLE1BQUEsTUFBQSxDQUFBLElBQUEsRUFBQSxNQUFBLEVBQUEsS0FBQSxFQUFBLEtBQUEsQ0FBQSxHQUFBLFVBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBOztFQUVBLE1BQUEsS0FBQSxDQUFBLElBQUEsS0FBQSxDQUFnQixNQUFNLENBQUEsRUFBQTtFQUN0QixNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUEsR0FBQSxHQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFvQixTQUFTLEVBQUE7RUFDN0IsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUEsR0FBQSxHQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFvQixTQUFTLEVBQUE7RUFDN0IsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBOztFQUVBLE1BQUEsS0FBQSxDQUFBLElBQUEsS0FBQSxDQUFnQixZQUFZLENBQUEsRUFBQTtFQUM1QixNQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUE7RUFDRSxRQUFBLE1BQUEsS0FBQTtFQUNBLFFBQUEsTUFBQSxDQUFBLElBQUEsR0FBQSxDQUFBO0VBQ0csTUFBQSxPQUFBLEdBQUEsRUFBQTtFQUNILFFBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBYyxNQUFPLEVBQUEsR0FBQSxDQUFBLE9BQUEsR0FBQSxFQUFBOztFQUV2QixNQUFBLElBQUE7RUFDRSxRQUFBLE1BQUEsSUFBQTtFQUNBLFFBQUEsTUFBQSxDQUFBLElBQUEsR0FBQSxDQUFBO0VBQ0csTUFBQSxPQUFBLEdBQUEsRUFBQTtFQUNILFFBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBYyxZQUFhLEVBQUEsR0FBQSxDQUFBLE9BQUEsR0FBQSxFQUFBOztFQUU3QixNQUFBLElBQUE7RUFDRSxRQUFBLE1BQUEsSUFBQTtFQUNBLFFBQUEsTUFBQSxDQUFBLElBQUEsR0FBQSxDQUFBO0VBQ0csTUFBQSxPQUFBLEdBQUEsRUFBQTtFQUNILFFBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBYyxZQUFhLEVBQUEsR0FBQSxDQUFBLE9BQUEsR0FBQSxFQUFBLEVBQUEsSUFBQSxFQUFBLElBQUE7OztFQUdqQyxFQUFBLFFBQUEsQ0FBVSxpQkFBa0IsR0FBQSxNQUFBO0VBQzFCLElBQUEsRUFBQSxDQUFJLE9BQVEsR0FBQSxNQUFBO0VBQ1YsTUFBQSxNQUFBLEdBQUEsR0FBQSxRQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBcUIsUUFBUSxFQUFBO0VBQzdCLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBd0IsVUFBVSxFQUFBO0VBQ2xDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBMkIsVUFBVSxFQUFBO0VBQ3JDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBMEIsVUFBVSxFQUFBO0VBQ3BDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBMEIsVUFBVSxFQUFBO0VBQ3BDLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBd0IsVUFBVSxFQUFBOztFQUVsQyxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBMEIsU0FBUyxFQUFBO0VBQ25DLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUEwQixTQUFTLEVBQUE7O0VBRW5DLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBLEdBQUEsRUFBQSxFQUFBLENBQUEsSUFBQTs7RUFFRixJQUFBLEVBQUEsQ0FBSSwwQkFBMkIsR0FBQSxZQUFBO0VBQzdCLE1BQUEsTUFBQSxHQUFBLEdBQUEsUUFBQSxFQUFBLEVBQUEsSUFBQSxHQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQUE7RUFDQSxNQUFBLEdBQUEsQ0FBQSxNQUFBLENBQUEsRUFBQSxFQUFBOztFQUVBLE1BQUEsSUFBQSxHQUFBLEdBQUEsR0FBQSxDQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFvQixTQUFTLEVBQUE7RUFDN0IsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBOztFQUVBLE1BQUEsSUFBQSxHQUFBLEdBQUEsR0FBQSxDQUFBLEtBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFvQixTQUFTLEVBQUE7RUFDN0IsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUE7O0VBRUEsTUFBQSxHQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsRUFBQTs7RUFFQSxNQUFBLE1BQUEsQ0FBQSxNQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsRUFBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEVBQUEsQ0FBQSxJQUFBOztFQUVGLElBQUEsRUFBQSxDQUFJLHlCQUEwQixHQUFBLFlBQUE7RUFDNUIsTUFBQSxNQUFBLEdBQUEsR0FBQSxRQUFBLEVBQUEsRUFBQSxJQUFBLEdBQUEsR0FBQSxDQUFBLEdBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTs7RUFFQSxNQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxLQUFBLENBQW9CLE1BQU0sQ0FBQSxFQUFBO0VBQzFCLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUEsR0FBQSxHQUFBLEdBQUEsQ0FBQSxLQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBb0IsU0FBUyxFQUFBO0VBQzdCLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxNQUFBLElBQUEsR0FBQSxHQUFBLEdBQUEsQ0FBQSxLQUFBLEdBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBb0IsU0FBUyxFQUFBO0VBQzdCLE1BQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBOztFQUVBLE1BQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLEtBQUEsQ0FBb0IsWUFBWSxDQUFBLEVBQUE7RUFDaEMsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxH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QSxDQUFBLENBQUEsQ0FBQSxFQUFBO0VBQ3hCLElBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQW1CLEdBQUcsRUFBQTs7O0VBR3BCLE1BQUEsTUFBQSxDQUFBLEdBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDQSxNQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLFVBQUEsQ0FBQTs7RUFFRixJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFtQixHQUFHLEVBQUE7RUFDdEIsSUFBQSxNQUFBLENBQUEsS0FBQSxDQUFjLFNBQVUsRUFBQSxNQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDeEIsSUFBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEtBQUEsQ0FBbUIsR0FBRyxFQUFBOzs7RUFHcEIsTUFBQSxNQUFBLENBQUEsR0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsVUFBQSxDQUFBOztFQUVGLElBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQW1CLEdBQUcsRUFBQTtNQUN0QixNQUFjLENBQUEsS0FBQSxDQUFBLElBQUEsRUFBQSxNQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7RUFDZCxJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFtQixHQUFHLEVBQUEsQ0FBQSxJQUFBLEVBQUE7O0VDOUUxQixRQUFBLENBQVUsYUFBYyxFQUFBLFdBQUE7RUFDdEIsRUFBQSxFQUFBLENBQUksT0FBUSxHQUFBLE1BQUE7RUFDVixJQUFBLE1BQUEsR0FBQSxHQUFBLFdBQUEsR0FBQTs7RUFFQSxJQUFBLE1BQUEsQ0FBQSxH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QUFlLEVBQUE7OztFQUduQyxJQUFBLE1BQUEsQ0FBQSxNQUFBLEtBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxLQUFBLENBQTZCLGFBQWEsRUFBQTs7O01BRzFDLE1BQXFCLENBQUEsTUFBQSxHQUFBLENBQUEsR0FBQSxDQUFBLFVBQVUsWUFBWSxhQUFhLEVBQUEsQ0FBQSxJQUFBLEVBQUE7O0VDdEM1RCxRQUFBLENBQVUsZUFBZ0IsR0FBQSxNQUFBOztFQUV4QixFQUFBLEVBQUEsQ0FBSSxPQUFRLEdBQUEsTUFBQTtFQUNWLElBQUEsTUFBQSxHQUFBLEdBQUEsYUFBQSxHQUFBO0VBQ0EsSUFBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQXFCLFFBQVEsRUFBQTtFQUM3QixJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXdCLFVBQVUsRUFBQTtFQUNsQyxJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXdCLFVBQVUsRUFBQTtFQUNsQyxJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXdCLFVBQVUsRUFBQTtFQUNsQyxJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTJCLFVBQVUsRUFBQTtFQUNyQyxJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTJCLFVBQVUsRUFBQSxDQUFBLElBQUE7O0VBRXZDLEVBQUEsRUFBQSxDQUFJLDJCQUE0QixHQUFBLFlBQUE7RUFDOUIsSUFBQSxNQUFBLEdBQUEsR0FBQSxhQUFBLEdBQUE7O0VBRUEsSUFBQSxJQUFBLEtBQUEsR0FBQSxHQUFBLENBQUEs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RUFBQSxDQUFBLEVBQUE7RUFDRixJQUFBLElBQUEsQ0FBQSxHQUFBLE9BQUEsQ0FBQSxHQUFBLEVBQUE7O0VBRUEsSUFBQSxJQUFBO0VBQ0UsTUFBQSxJQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsSUFBQSxHQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQWtCLFNBQVMsRUFBQTs7RUFFM0IsTUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsTUFBQSxFQUFBO0VBQ0EsTUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsRUFBQSxLQUFBLEVBQUEsQ0FBQTs7RUFFRixZQUFBO0VBQ0UsTUFBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQSxJQUFBOzs7RUFHSixFQUFBLEVBQUEsQ0FBSSxhQUFjLEdBQUEsWUFBQTtFQUNoQixJQUFBLElBQUEsR0FBQSxHQUFBLGlCQUFBO0VBQ0UsTUFBQSxXQUFBLENBQUEsRUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxDQUFBLENBQUEsRUFBQTtFQUNGLElBQUEsSUFBQSxDQUFBLEdBQUEsT0FBQSxDQUFBLEdBQUEsRUFBQTs7RUFFQSxJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQTZCLFNBQVMsRUFBQTs7RUFFdEMsSUFBQSxJQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsSUFBQSxHQUFBO0VBQ0EsSUFBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQWtCLFNBQVMsRUFBQTs7RUFFM0IsSUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsTUFBQSxFQUFBO0VBQ0EsSUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBQSxLQUFBLEVBQUE7O0VBRUEsSUFBQSxNQUFBLEdBQUEsQ0FBQSxTQUFBLENBQUEsSUFBQTs7O0VBR0YsRUFBQSxFQUFBLENBQUksK0NBQWdELEdBQUEsWUFBQTtFQUNsRCxJQUFBLElBQUEsQ0FBQSxHQUFBLE1BQUE7RUFDRSxNQUFBLGNBQUE7RUFDRSxRQUFBLENBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxDQUFBO0VBQ0EsUUFBQSxXQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsR0FBQTs7RUFFSixJQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxJQUFBLEdBQUE7RUFDQSxJQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBa0IsU0FBUyxFQUFBOztFQUUzQixJQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxNQUFBLEVBQUE7RUFDQSxJQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBQTs7RUFFQSxJQUFBLElBQUEsR0FBQSxHQUFBLENBQUEsS0FBQSxFQUFBO0VBQ1MsSUFBQSxXQUFBLElBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQTtFQUNQLE1BQUEsR0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQTs7RUFFRixJQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsSUFBQSxDQUFBLEtBQUE7RUFDRSxNQUFBLENBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUEsRUFBQSxDQUFBLEVBQUEsRUFBQSxJQUFBOzs7RUFHSixFQUFBLEVBQUEsQ0FBSSxVQUFXLEdBQUEsWUFBQTtFQUNiLElBQUEsSUFBQSxDQUFBLEdBQUEsTUFBQSxDQUFnQixRQUFXLENBQUEsV0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUE7O0VBRTNCLElBQUEsSUFBQTtFQUNFLE1BQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLElBQUEsR0FBQTtFQUNBLE1BQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENB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
