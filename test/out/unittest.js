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
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
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
    let x, p=0;
    let fence  = () => ( 0!==p ? p : p=(x=ao_defer_v())[0] );
    let resume = ans => { if (0!==p) { p=0; x[1](ans); }};
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvdHJhY2suanN5IiwiLi4vdW5pdC9mZW5jZV92LmpzeSIsIi4uL3VuaXQvZmVuY2VfZm4uanN5IiwiLi4vdW5pdC9mZW5jZV9vYmouanN5IiwiLi4vdW5pdC93aGVuX2RlZmVyLmpzeSIsIi4uL3VuaXQvd2hlbl90cmFjay5qc3kiLCIuLi91bml0L3doZW5fZmVuY2UuanN5IiwiLi4vdW5pdC9mZW5jZV9vdXQuanN5IiwiLi4vdW5pdC9mZW5jZV9pbi5qc3kiLCIuLi91bml0L3hmb3JtLmpzeSIsIi4uL3VuaXQvZm9sZC5qc3kiLCIuLi91bml0L3F1ZXVlLmpzeSIsIi4uL3VuaXQvZmVuY2VfYmFyZS5qc3kiLCIuLi91bml0L2ZlbmNlX3N0cmVhbS5qc3kiLCIuLi91bml0L3RpbWUuanN5IiwiLi4vdW5pdC9kb21fYW5pbS5qc3kiLCIuLi91bml0L2RvbV9saXN0ZW4uanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgYXNzZXJ0LCBleHBlY3QgfSA9IHJlcXVpcmUoJ2NoYWknKVxuZXhwb3J0IEB7fSBhc3NlcnQsIGV4cGVjdFxuXG5leHBvcnQgY29uc3QgZGVsYXkgPSAobXM9MSkgPT4gXG4gIG5ldyBQcm9taXNlIEAgeSA9PlxuICAgIHNldFRpbWVvdXQgQCB5LCBtcywgJ3RpbWVvdXQnXG5cbmV4cG9ydCBjb25zdCBkZWxheV9yYWNlID0gKHAsIG1zPTEpID0+IFxuICBQcm9taXNlLnJhY2UgQCMgcCwgZGVsYXkobXMpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGRlbGF5X3dhbGsoZ19pbiwgbXM9MSkgOjpcbiAgYXdhaXQgZGVsYXkobXMpXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnX2luIDo6XG4gICAgeWllbGQgdlxuICAgIGF3YWl0IGRlbGF5KG1zKVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZm4oZm4pIDo6XG4gIGV4cGVjdChmbikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICByZXR1cm4gZm5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2dlbihnKSA6OlxuICBpc19mbihnLm5leHQpXG4gIGlzX2ZuKGcucmV0dXJuKVxuICBpc19mbihnLnRocm93KVxuICByZXR1cm4gZ1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmVuY2VfY29yZShmKSA6OlxuICBpc19mbihmLmZlbmNlKVxuICBpc19mbihmLmFvX2ZvcmspXG4gIGlzX2FzeW5jX2l0ZXJhYmxlKGYpXG5cbiAgaXNfZm4oZi5hb19jaGVja19kb25lKVxuICAvLyBpc19mbihmLmNoYWluKSAtLSBtb3ZlZCB0byBleHBlcmltZW50YWwvY2hhaW4ubWRcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2dlbihmKSA6OlxuICBpc19mZW5jZV9jb3JlKGYpXG4gIGlzX2ZuKGYuYWJvcnQpXG4gIGlzX2ZuKGYucmVzdW1lKVxuXG4gIGlzX2dlbihmKVxuICByZXR1cm4gZlxuXG5leHBvcnQgZnVuY3Rpb24gaXNfYXN5bmNfaXRlcmFibGUobykgOjpcbiAgYXNzZXJ0IEAgbnVsbCAhPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgJ2FzeW5jIGl0ZXJhYmxlJ1xuICByZXR1cm4gb1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXJyYXlfZnJvbV9hb19pdGVyKGcpIDo6XG4gIGxldCByZXMgPSBbXVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgIHJlcy5wdXNoKHYpXG4gIHJldHVybiByZXNcblxuIiwiY29uc3QgaXNfYW9faXRlciA9IGcgPT5cbiAgbnVsbCAhPSBnW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTtcblxuY29uc3QgaXNfYW9fZm4gPSB2X2ZuID0+XG4gICdmdW5jdGlvbicgPT09IHR5cGVvZiB2X2ZuXG4gICAgJiYgISBpc19hb19pdGVyKHZfZm4pO1xuXG5cbmNvbnN0IGFvX2RvbmUgPSBPYmplY3QuZnJlZXplKHthb19kb25lOiB0cnVlfSk7XG5jb25zdCBhb19jaGVja19kb25lID0gZXJyID0+IHtcbiAgaWYgKGVyciAhPT0gYW9fZG9uZSAmJiBlcnIgJiYgIWVyci5hb19kb25lKSB7XG4gICAgdGhyb3cgZXJyfVxuICByZXR1cm4gdHJ1ZX07XG5cblxuY29uc3QgX2FnX2NvcHkgPSAoe2dfaW59LCBhZ19vdXQpID0+KFxuICB1bmRlZmluZWQgPT09IGdfaW4gPyBhZ19vdXQgOihcbiAgICBhZ19vdXQuZ19pbiA9IGdfaW5cbiAgLCBhZ19vdXQpICk7XG5cbmZ1bmN0aW9uIGFvX3doZW5fbWFwKGFvX2ZuX3YsIGRiPW5ldyBNYXAoKSwgcmVqZWN0X2RlbGV0ZWQpIHtcbiAgbGV0IGlkeF9kZWwgPSByZWplY3RfZGVsZXRlZCA/IDIgOiAxO1xuICByZXR1cm4ge1xuICAgIGhhczogayA9PiBkYi5oYXMoaylcbiAgLCBnZXQ6IGsgPT4gYXQoaylbMF0gLy8gcHJvbWlzZSBvZiBkZWZlcnJlZFxuICAsIHNldDogZGVmaW5lLCBkZWZpbmVcbiAgLCBkZWxldGUoaykge1xuICAgICAgbGV0IGIsIGUgPSBkYi5nZXQoayk7XG4gICAgICBpZiAoYiA9ICh1bmRlZmluZWQgIT09IGUpKSB7XG4gICAgICAgIGRiLmRlbGV0ZShrKTtcbiAgICAgICAgZVtpZHhfZGVsXSgpOyB9Ly8gZS5nLiByZXNvbHZlKHVuZGVmaW5lZClcbiAgICAgIHJldHVybiBifVxuICAsIGNsZWFyKCkge1xuICAgICAgLy8gXCJkZWxldGVcIiByZW1haW5pbmcgb24gbmV4dCBwcm9taXNlIHRpY2tcbiAgICAgIHAgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgIGZvciAobGV0IGUgb2YgZGIudmFsdWVzKCkpIHtcbiAgICAgICAgcC50aGVuKGVbaWR4X2RlbF0pOyB9Ly8gZS5nLiByZXNvbHZlICh1bmRlZmluZWQpXG5cbiAgICAgIGRiLmNsZWFyKCk7IH0gfS8vIGNsZWFyIGRiXG5cbiAgZnVuY3Rpb24gYXQoaykge1xuICAgIGxldCBlID0gZGIuZ2V0KGspO1xuICAgIGlmICh1bmRlZmluZWQgPT09IGUpIHtcbiAgICAgIGRiLnNldChrLCBlPWFvX2ZuX3YoKSk7fVxuICAgIHJldHVybiBlfVxuXG4gIGZ1bmN0aW9uIGRlZmluZShrLCB2KSB7XG4gICAgbGV0IFtwLCBmbl9mdWxmaWxsXSA9IGF0KGspO1xuICAgIGZuX2Z1bGZpbGwodik7IC8vIGUuZy4gZGVmZXJyZWQncyByZXNvbHZlKHYpIG9yIGZlbmNlJ3MgcmVzdW1lKHYpXG4gICAgcmV0dXJuIHAgfSB9Ly8gcHJvbWlzZSBvZiBkZWZlcnJlZFxuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBhc19yZXMocCwgeSwgbikpIH1cblxuY29uc3QgYW9fZGVmZXJfdiA9IC8qICNfX1BVUkVfXyAqL1xuICBhb19kZWZlcl9jdHgoKTtcblxuY29uc3QgYW9fZGVmZXJfbyA9IC8qICNfX1BVUkVfXyAqL1xuICBhb19kZWZlcl9jdHgoKHAseSxuKSA9PlxuICAgICh7cHJvbWlzZTogcCwgcmVzb2x2ZTogeSwgcmVqZWN0OiBufSkpO1xuXG5jb25zdCBhb19kZWZlcl93aGVuID0gZGIgPT5cbiAgYW9fd2hlbl9tYXAoYW9fZGVmZXJfdiwgZGIpO1xuXG5hc3luYyBmdW5jdGlvbiBhb19ydW4oZ2VuX2luKSB7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7fSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gYW9fZHJpdmUoZ2VuX2luLCBnZW5fdGd0LCBjbG9zZV90Z3QpIHtcbiAgaWYgKGlzX2FvX2ZuKGdlbl90Z3QpKSB7XG4gICAgZ2VuX3RndCA9IGdlbl90Z3QoKTtcbiAgICBnZW5fdGd0Lm5leHQoKTt9XG5cbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICBsZXQge2RvbmV9ID0gYXdhaXQgZ2VuX3RndC5uZXh0KHYpO1xuICAgIGlmIChkb25lKSB7YnJlYWt9IH1cblxuICBpZiAoY2xvc2VfdGd0KSB7XG4gICAgYXdhaXQgZ2VuX3RndC5yZXR1cm4oKTt9IH1cblxuXG5cbmZ1bmN0aW9uICogaXRlcihpdGVyYWJsZSkge1xuICByZXR1cm4gKHlpZWxkICogaXRlcmFibGUpfVxuXG5mdW5jdGlvbiBhb19zdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihpdGVyYWJsZSkge1xuICByZXR1cm4gKHlpZWxkICogaXRlcmFibGUpfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX2l0ZXJfZmVuY2VkKGl0ZXJhYmxlLCBmX2dhdGUsIGluaXRpYWw9ZmFsc2UpIHtcbiAgbGV0IGYgPSB0cnVlID09PSBpbml0aWFsID8gZl9nYXRlLmZlbmNlKCkgOiBpbml0aWFsO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgYXdhaXQgZjtcbiAgICB5aWVsZCB2O1xuICAgIGYgPSBmX2dhdGUuZmVuY2UoKTt9IH1cblxuXG5jb25zdCBhb19pdGVyX2ZlbmNlZCA9ICguLi5hcmdzKSA9PlxuICBfYWdfY29weShhcmdzWzBdLCBfYW9faXRlcl9mZW5jZWQoLi4uYXJncykpO1xuXG5mdW5jdGlvbiBhb19mZW5jZV9vKHByb3RvKSB7XG4gIGxldCByID0gYW9fZmVuY2VfdigpO1xuICByZXR1cm4ge19fcHJvdG9fXzogcHJvdG8sXG4gICAgZmVuY2U6IHJbMF0sIHJlc3VtZTogclsxXSwgYWJvcnQ6IHJbMl19IH1cblxuZnVuY3Rpb24gYW9fZmVuY2VfdigpIHtcbiAgbGV0IHgsIHA9MDtcbiAgbGV0IGZlbmNlICA9ICgpID0+ICggMCE9PXAgPyBwIDogcD0oeD1hb19kZWZlcl92KCkpWzBdICk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4geyBpZiAoMCE9PXApIHsgcD0wOyB4WzFdKGFucyk7IH19O1xuICBsZXQgYWJvcnQgID0gZXJyID0+IHsgaWYgKDAhPT1wKSB7IHA9MDsgeFsyXShlcnIgfHwgYW9fZG9uZSk7IH19O1xuICByZXR1cm4gW2ZlbmNlLCByZXN1bWUsIGFib3J0XSB9XG5cblxuY29uc3QgYW9fZmVuY2Vfd2hlbiA9IGRiID0+XG4gIGFvX3doZW5fbWFwKGFvX2ZlbmNlX3YsIGRiKTtcblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyX2ZlbmNlKGZlbmNlKSB7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCByID0gYXdhaXQgZmVuY2UoKTtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHIpIHtcbiAgICAgICAgeWllbGQgcjt9IH0gfVxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2NvcmVfYXBpXyA9IHtcbiAgYW9fY2hlY2tfZG9uZVxuXG4sIC8vIGNvcHlhYmxlIGZlbmNlIGZvcmsgYXBpXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfVxuXG4sIGFvX2ZvcmsoKSB7XG4gICAgbGV0IGFnID0gYW9faXRlcl9mZW5jZSh0aGlzLmZlbmNlKTtcbiAgICBsZXQge3hlbWl0fSA9IHRoaXM7XG4gICAgcmV0dXJuIHhlbWl0ID8geGVtaXQoYWcpIDogYWd9IH07XG5cblxuZnVuY3Rpb24gYW9fZmVuY2VfZm4odGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfdigpO1xuICBpZiAodW5kZWZpbmVkID09PSB0Z3QpIHt0Z3QgPSBmWzBdO31cbiAgdGd0LmZlbmNlID0gT2JqZWN0LmFzc2lnbih0Z3QsIF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuICByZXR1cm4gZn1cblxuXG5jb25zdCBhb19mZW5jZV9vYmogPSAoKSA9PlxuICBhb19mZW5jZV9vKF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuXG5cbmZ1bmN0aW9uIGFzX2l0ZXJfcHJvdG8ocmVzdW1lLCBhYm9ydCwgZG9uZSA9IHRydWUpIHtcbiAgcmV0dXJuIHtcbiAgICBuZXh0OiB2ID0+KHt2YWx1ZTogcmVzdW1lKHYpLCBkb25lfSlcbiAgLCByZXR1cm46ICgpID0+KHt2YWx1ZTogYWJvcnQoYW9fZG9uZSksIGRvbmV9KVxuICAsIHRocm93OiAoZXJyKSA9Pih7dmFsdWU6IGFib3J0KGVyciksIGRvbmV9KSB9IH1cblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmZ1bmN0aW9uIGFvX3RyYWNrKHByb3RvLCByZXNldF92KSB7XG4gIGxldCByID0gYW9fdHJhY2tfdihyZXNldF92KTtcbiAgcmV0dXJuIHtfX3Byb3RvX186IHByb3RvLFxuICAgIHRpcDogKCkgPT4gclswXSAvLyBvciBmZW5jZShmYWxzZSlcbiAgLCByZXN1bWU6IHJbMV1cbiAgLCBhYm9ydDogclsyXVxuICAsIGZlbmNlOiByWzNdXG4gICwgZnRyOiAoKSA9PiByWzRdIH0gfS8vIG9yIGZlbmNlKHRydWUpXG5cbmZ1bmN0aW9uIGFvX3RyYWNrX3YocmVzZXRfdiA9ICgpPT5hb19kZWZlcl92KCkpIHtcbiAgLy8gbGlrZSBhb19kZWZlcl92KCkgYW5kIHJlc2V0YWJsZSBsaWtlIGFvX2ZlbmNlX3YoKVxuICBsZXQgcjsgLy8gciBpcyB0aGUgY3VycmVudCAvIHRyYWNrZWQgdmFsdWUgZGVmaW5lZCBiZWxvd1xuICBsZXQgeD1yZXNldF92KCk7IC8vIHggaXMgdGhlIGZ1dHVyZS9kZWZlcnJlZFxuXG4gIGxldCBwOyAvLyBwIGlzIHRoZSByYWNoZXQgbWVtb3J5IGZvciB0aGUgZmVuY2UoKSBjbG9zdXJlXG4gIC8vIHNpbWlsYXIgdG8gZmVuY2UuZmVuY2UoKSB3aGlsZSBhbHNvIHRyYWNraW5nIHRoZSBsYXN0IGNvbXBsZXRlZCBkZWZlcnJlZFxuICBsZXQgZmVuY2UgPSBmdHIgPT4oXG4gICAgZmFsc2U9PT1mdHIgPyByWzBdIDogdHJ1ZT09PWZ0ciA/IHhbMF0gOiAvLyBub24tcmFjaGV0aW5nIHF1ZXJpZXNcbiAgICBwPT09eFswXSB8fCBwPT09clswXSA/IHA9eFswXSA6IHA9clswXSApOy8vIHJhY2hldGluZyBxdWVyeVxuXG4gIC8vIGxpa2UgZmVuY2UucmVzdW1lLCByZXNvbHZlcyB0aGUgZnV0dXJlL2RlZmVycmVkIHhbMF07IHRoZW4gcmVzZXRzIHggZnV0dXJlL2RlZmVycmVkXG4gIGxldCByZXN1bWUgPSBhbnMgPT4geHooeFsxXSwgYW5zKTtcblxuICAvLyBsaWtlIGZlbmNlLmFib3J0LCByZWplY3RzIHRoZSBmdXR1cmUvZGVmZXJyZWQgeFswXTsgdGhlbiByZXNldHMgeCBmdXR1cmUvZGVmZXJyZWRcbiAgbGV0IGFib3J0ICA9IGVyciA9PiB4eih4WzJdLCBlcnIgfHwgYW9fZG9uZSk7XG5cbiAgLy8gbWF0Y2ggYW9fZGVmZXJfdigpIG9mIFtjdXJyZW50IHByb21pc2UsIHJlc29sdmUsIHJlamVjdF0gd2l0aCBhZGRpdGlvbmFsIFtmZW5jZSwgZnRyIHByb21pc2VdXG4gIHJldHVybiByID0gWyBwPXhbMF0sIHJlc3VtZSwgYWJvcnQsIGZlbmNlLCB4WzBdIF1cblxuICBmdW5jdGlvbiB4eih4Ziwgdikge1xuICAgIC8vIDEuIHVwZGF0ZSBjdXJyZW50IC8gdGlwIHNsb3Q6IHJbMF0gPSB4WzBdXG4gICAgLy8gMi4gcmUtcHJpbWUgZmVuY2U6IHggPSByZXNldF92KHJbMF1dXG4gICAgeCA9IHJlc2V0X3YoclswXSA9IHhbMF0pO1xuICAgIHJbNF0gPSB4WzBdOyAvLyB1cGRhdGUgcHVibGljIGZ0ciBzbG90XG4gICAgeGYodik7IH0gfS8vIHJlc3VtZS9hYm9ydCByWzBdIGN1cnJlbnQgLyB0aXBcblxuXG5jb25zdCBhb190cmFja193aGVuID0gZGIgPT5cbiAgYW9fd2hlbl9tYXAoYW9fdHJhY2tfdiwgZGIpO1xuXG5mdW5jdGlvbiBhb190cmFja19mbih0Z3QsIHJlc2V0X3YpIHtcbiAgbGV0IHIgPSBhb190cmFja192KHJlc2V0X3YpO1xuICBpZiAodW5kZWZpbmVkID09PSB0Z3QpIHt0Z3QgPSByWzNdO31cbiAgdGd0LmZlbmNlID0gT2JqZWN0LmFzc2lnbih0Z3QsIF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuICByZXR1cm4gcn1cblxuY29uc3QgYW9fdHJhY2tfb2JqID0gKCkgPT5cbiAgYW9fdHJhY2soX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IC8qICNfX1BVUkVfXyAqLyBhb19mZW5jZV9vLmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG4sIF9hb19tYW55KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOyBjb25zaWRlciAuYW9fZm9yaygpIG9yIC5hbGxvd19tYW55KCknKX1cblxuLCBhbGxvd19tYW55KCkge1xuICAgIGxldCB7YW9fZm9yaywgYW9fYm91bmQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgaWYgKF9hb19tYW55ID09PSBhb19ib3VuZCkge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IGFvX2Zvcms7fVxuICAgIHRoaXMuX2FvX21hbnkgPSBhb19mb3JrO1xuICAgIHRoaXMuYWxsb3dfbWFueSA9ICgpID0+IHRoaXM7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMuYW9fYm91bmQoKSk7IH1cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgbGV0IHt4ZW1pdCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBfYW9fbWFueTtcbiAgICAgIHJldHVybiB4ZW1pdFxuICAgICAgICA/IF9hZ19jb3B5KGFnX291dCwgeGVtaXQoYWdfb3V0KSlcbiAgICAgICAgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmJpbmRfZ2F0ZWQoZl9nYXRlKS5hb19ib3VuZCgpfVxuXG4sIF9hb19nYXRlZChmX2dhdGUpIHtyZXR1cm4gYW9nX2dhdGVkKHRoaXMsIGZfZ2F0ZSl9IH0gKTtcblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19nYXRlZChmX291dCwgZl9nYXRlKSB7XG4gIHRyeSB7XG4gICAgZl9vdXQucmVzdW1lKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICB5aWVsZCB2O1xuICAgICAgZl9vdXQucmVzdW1lKHYpO30gfVxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9vdXQuYWJvcnQoKTtcbiAgICBpZiAoZl9nYXRlLmFib3J0KSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTt9IH0gfVxuXG5jb25zdCBhb19mZWVkZXIgPSAoe2dfaW59KSA9PiB2ID0+IGdfaW4ubmV4dCh2KTtcbmNvbnN0IGFvX2ZlZWRlcl92ID0gKHtnX2lufSkgPT4gKC4uLmFyZ3MpID0+IGdfaW4ubmV4dChhcmdzKTtcblxuXG5mdW5jdGlvbiBhb2dfZmVuY2VfeGYoeGluaXQsIC4uLmFyZ3MpIHtcbiAgbGV0IGZfaW4gPSBhb19mZW5jZV9vKCksIGZfb3V0ID0gYW9fZmVuY2VfbygpO1xuICBsZXQgZ19pbiA9IHhpbml0KGZfaW4sIGZfb3V0LCAuLi5hcmdzKTtcbiAgZ19pbi5uZXh0KCk7XG5cbiAgbGV0IHJlcyA9IGFvZ19nYXRlZChmX291dCwgZl9pbik7XG4gIHJlcy5mZW5jZSA9IGZfb3V0LmZlbmNlO1xuICByZXMuZ19pbiA9IGdfaW47XG4gIHJldHVybiByZXN9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2l0ZXIoLi4uYXJncykge1xuICByZXR1cm4gYW9nX2ZlbmNlX3hmKGFvZ19pdGVyLCAuLi5hcmdzKX1cblxuZnVuY3Rpb24gYW9fZmVuY2Vfc2luayguLi5hcmdzKSB7XG4gIHJldHVybiBhb2dfZmVuY2VfeGYoYW9nX3NpbmssIC4uLmFyZ3MpfVxuXG5cbmZ1bmN0aW9uICogYW9nX2l0ZXIoZl9pbiwgZl9nYXRlLCB4Zikge1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgICB0aXAgPSAoeGYubmV4dCh0aXApKS52YWx1ZTt9XG4gICAgICBmX2luLnJlc3VtZSh0aXApO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX2luLmFib3J0KCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb2dfc2luayhmX2luLCBmX2dhdGUsIHhmKSB7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgICB7XG4gICAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgICB0aXAgPSAoYXdhaXQgeGYubmV4dCh0aXApKS52YWx1ZTt9XG4gICAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fVxuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBmX2dhdGUpIHtcbiAgICAgICAgYXdhaXQgZl9nYXRlLmZlbmNlKCk7fSB9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5jb25zdCBhb194Zm9ybSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3hmb3JtKG5zX2dlbik7XG5jb25zdCBhb19mb2xkID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fZm9sZChuc19nZW4pO1xuY29uc3QgYW9fcXVldWUgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZShuc19nZW4pO1xuXG5jb25zdCBhb19mZW5jZV9pbiA9IC8qICNfX1BVUkVfXyAqLyBhb19mZW5jZV9vLmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIGFvX2ZvbGQobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfaXRlciwgLi4uIG5zX2dlbn0pfVxuLCBhb19xdWV1ZShuc19nZW4pIHtyZXR1cm4gdGhpcy5hb194Zm9ybSh7eGluaXQ6IGFvZ19zaW5rLCAuLi4gbnNfZ2VufSl9XG5cbiwgYW9nX2l0ZXIoeGYpIHtyZXR1cm4gYW9nX2l0ZXIodGhpcyl9XG4sIGFvZ19zaW5rKGZfZ2F0ZSwgeGYpIHtyZXR1cm4gYW9nX3NpbmsodGhpcywgZl9nYXRlLCB4Zil9XG5cbiwgYW9feGZvcm0obnNfZ2VuPXt9KSB7XG4gICAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb3V0KCk7XG5cbiAgICBsZXQge3hlbWl0LCB4aW5pdCwgeHJlY3Z9ID1cbiAgICAgIGlzX2FvX2ZuKG5zX2dlbilcbiAgICAgICAgPyBuc19nZW4odGhpcywgZl9vdXQpXG4gICAgICAgIDogbnNfZ2VuO1xuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGVtaXQpIHtcbiAgICAgIGZfb3V0LnhlbWl0ID0geGVtaXQ7fVxuXG4gICAgaWYgKCEgeGluaXQpIHt4aW5pdCA9IGFvZ19zaW5rO31cbiAgICBsZXQgcmVzID0geGluaXQodGhpcywgZl9vdXQsXG4gICAgICB4cmVjdiA/IF94Zl9nZW4uY3JlYXRlKHhyZWN2KSA6IHVuZGVmaW5lZCk7XG5cbiAgICBsZXQgZ19pbiA9IGZfb3V0LmdfaW4gPSByZXMuZ19pbiB8fCByZXM7XG4gICAgcmV0dXJuIHJlcyAhPT0gZ19pblxuICAgICAgPyByZXMgLy8gcmVzIGlzIGFuIG91dHB1dCBnZW5lcmF0b3JcbiAgICAgIDooLy8gcmVzIGlzIGFuIGlucHV0IGdlbmVyYXRvclxuICAgICAgICAgIGdfaW4ubmV4dCgpLFxuICAgICAgICAgIGZfb3V0LmJpbmRfZ2F0ZWQodGhpcykpIH1cblxuLCAvLyBFUzIwMTUgZ2VuZXJhdG9yIGFwaVxuICBuZXh0KHYpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLnJlc3VtZSh2KSwgZG9uZTogdHJ1ZX19XG4sIHJldHVybigpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGFvX2RvbmUpLCBkb25lOiB0cnVlfX1cbiwgdGhyb3coZXJyKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChlcnIpLCBkb25lOiB0cnVlfX0gfSApO1xuXG5cbmNvbnN0IF94Zl9nZW4gPSB7XG4gIGNyZWF0ZSh4Zikge1xuICAgIGxldCBzZWxmID0ge19fcHJvdG9fXzogdGhpc307XG4gICAgc2VsZi54ZyA9IHhmKHNlbGYueGZfaW52KCkpO1xuICAgIHJldHVybiBzZWxmfVxuXG4sICp4Zl9pbnYoKSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB0aGlzLl90aXA7XG4gICAgICBpZiAodGhpcyA9PT0gdGlwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5kZXJmbG93Jyl9XG4gICAgICBlbHNlIHRoaXMuX3RpcCA9IHRoaXM7XG5cbiAgICAgIHlpZWxkIHRpcDt9IH1cblxuLCBuZXh0KHYpIHtcbiAgICB0aGlzLl90aXAgPSB2O1xuICAgIHJldHVybiB0aGlzLnhnLm5leHQodil9XG5cbiwgcmV0dXJuKCkge3RoaXMueGcucmV0dXJuKCk7fVxuLCB0aHJvdygpIHt0aGlzLnhnLnRocm93KCk7fSB9O1xuXG5mdW5jdGlvbiBhb19wdXNoX3N0cmVhbShhc192ZWMpIHtcbiAgbGV0IHE9W10sIFtmZW5jZSwgcmVzdW1lLCBhYm9ydF0gPSBhb19mZW5jZV92KCk7XG4gIGxldCBzdHJlYW0gPSBhb19zdHJlYW1fZmVuY2UoZmVuY2UpO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHN0cmVhbSx7XG4gICAgc3RyZWFtXG4gICwgYWJvcnRcbiAgLCBwdXNoKC4uLiBhcmdzKSB7XG4gICAgICBpZiAodHJ1ZSA9PT0gYXNfdmVjKSB7XG4gICAgICAgIHEucHVzaChhcmdzKTt9XG4gICAgICBlbHNlIHEucHVzaCguLi4gYXJncyk7XG5cbiAgICAgIHJlc3VtZShxKTtcbiAgICAgIHJldHVybiBxLmxlbmd0aH0gfSApIH1cblxuXG5mdW5jdGlvbiBhb19zdHJlYW1fZmVuY2UoZmVuY2UpIHtcbiAgbGV0IFt3aGVuX2RvbmUsIHJlc19kb25lLCByZWpfZG9uZV0gPSBhb19kZWZlcl92KCk7XG4gIGxldCByZXMgPSBfYW9fc3RyZWFtX2ZlbmNlKGZlbmNlLCByZXNfZG9uZSwgcmVqX2RvbmUpO1xuICByZXMud2hlbl9kb25lID0gd2hlbl9kb25lO1xuICByZXR1cm4gcmVzfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3N0cmVhbV9mZW5jZShmZW5jZSwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gIHRyeSB7XG4gICAgbGV0IHBfcmVhZHkgPSBmZW5jZSgpO1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgYmF0Y2ggPSBhd2FpdCBwX3JlYWR5O1xuICAgICAgYmF0Y2ggPSBiYXRjaC5zcGxpY2UoMCwgYmF0Y2gubGVuZ3RoKTtcblxuICAgICAgcF9yZWFkeSA9IGZlbmNlKCk7XG4gICAgICB5aWVsZCAqIGJhdGNoO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIWVyciB8fCBlcnIuYW9fZG9uZSkge1xuICAgICAgcmVzb2x2ZSh0cnVlKTt9XG4gICAgZWxzZSByZWplY3QoZXJyKTt9IH1cblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKHRpbWVvdXQpO1xuICB0aW1lb3V0LnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFyVGltZW91dCh0aWQpO1xuICAgIF9hYm9ydCgpO30pO1xuICByZXR1cm4gdGltZW91dFxuXG4gIGZ1bmN0aW9uIHRpbWVvdXQobXNfbmV4dD1tcykge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXNfbmV4dCwgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGFvX2l0ZXJhYmxlKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2Uud2hlbl9ydW4gPSAoKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgbGV0IHA7XG4gICAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGFvX2l0ZXJhYmxlKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgICBwID0gX2ZlbmNlKCk7XG4gICAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIHYpO1xuICAgICAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fSB9XG5cbiAgICAgIGF3YWl0IHA7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhhb19pdGVyYWJsZSkge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgIHlpZWxkIFtEYXRlLm5vdygpIC0gdHMwLCB2XTt9IH1cblxuZnVuY3Rpb24gYW9fZG9tX2FuaW1hdGlvbigpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbihyYWYpO1xuICByYWYuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2FuY2VsQW5pbWF0aW9uRnJhbWUodGlkKTtcbiAgICByYWYuZG9uZSA9IHRydWU7fSk7XG5cbiAgcmV0dXJuIHJhZlxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc3VtZSk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IF9ldnRfaW5pdCA9IFByb21pc2UucmVzb2x2ZSh7dHlwZTonaW5pdCd9KTtcbmZ1bmN0aW9uIGFvX2RvbV9saXN0ZW4oc2VsZj1hb19xdWV1ZSgpKSB7XG4gIHJldHVybiBfYmluZC5zZWxmID0gc2VsZiA9e1xuICAgIF9fcHJvdG9fXzogc2VsZlxuICAsIHdpdGhfZG9tKGRvbSwgZm4pIHtcbiAgICAgIHJldHVybiBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgICAgOiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZG9tKX0gfVxuXG4gIGZ1bmN0aW9uIF9iaW5kKGRvbSwgZm5fZXZ0LCBmbl9kb20pIHtcbiAgICByZXR1cm4gZXZ0ID0+IHtcbiAgICAgIGxldCB2ID0gZm5fZXZ0XG4gICAgICAgID8gZm5fZXZ0KGV2dCwgZG9tLCBmbl9kb20pXG4gICAgICAgIDogZm5fZG9tKGRvbSwgZXZ0KTtcblxuICAgICAgaWYgKG51bGwgIT0gdikge1xuICAgICAgICBzZWxmLmdfaW4ubmV4dCh2KTt9IH0gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSB7XG4gIGxldCBfb25fZXZ0O1xuICBpZiAoaXNfYW9fZm4oZm4pKSB7XG4gICAgX2V2dF9pbml0LnRoZW4oXG4gICAgICBfb25fZXZ0ID0gX2JpbmQoZG9tLCB2b2lkIDAsIGZuKSk7IH1cblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBsZXQgb3B0LCBldnRfZm4gPSBfb25fZXZ0O1xuXG4gICAgICBsZXQgbGFzdCA9IGFyZ3MucG9wKCk7XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgZXZ0X2ZuID0gX2JpbmQoZG9tLCBsYXN0LCBfb25fZXZ0KTtcbiAgICAgICAgbGFzdCA9IGFyZ3MucG9wKCk7fVxuXG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGFyZ3MucHVzaChsYXN0KTt9XG4gICAgICBlbHNlIG9wdCA9IGxhc3Q7XG5cbiAgICAgIGZvciAobGV0IGV2dCBvZiBhcmdzKSB7XG4gICAgICAgIGRvbS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIGV2dCwgZXZ0X2ZuLCBvcHQpOyB9XG5cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZWN0eF9saXN0KSB7XG4gIGVjdHhfbGlzdCA9IEFycmF5LmZyb20oZWN0eF9saXN0LFxuICAgIGRvbSA9PiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pKTtcblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBmb3IgKGxldCBlY3R4IG9mIGVjdHhfbGlzdCkge1xuICAgICAgICBlY3R4Lmxpc3RlbiguLi5hcmdzKTt9XG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cbmV4cG9ydCB7IF9hZ19jb3B5LCBfYW9fZmVuY2VfY29yZV9hcGlfLCBfYW9faXRlcl9mZW5jZWQsIF9hb19ydW4sIF9hb190YXAsIGFvX2NoZWNrX2RvbmUsIGFvX2RlYm91bmNlLCBhb19kZWZlcl9jdHgsIGFvX2RlZmVyX28sIGFvX2RlZmVyX3YsIGFvX2RlZmVyX3doZW4sIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9saXN0ZW4sIGFvX2RvbmUsIGFvX2RyaXZlLCBhb19mZWVkZXIsIGFvX2ZlZWRlcl92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfaW4sIGFvX2ZlbmNlX2l0ZXIsIGFvX2ZlbmNlX28sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2Vfb3V0LCBhb19mZW5jZV9zaW5rLCBhb19mZW5jZV92LCBhb19mZW5jZV93aGVuLCBhb19mb2xkLCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9faXRlcl9mZW5jZSwgYW9faXRlcl9mZW5jZWQsIGFvX3B1c2hfc3RyZWFtLCBhb19xdWV1ZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb19zdHJlYW1fZmVuY2UsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGFvX3RyYWNrLCBhb190cmFja19mbiwgYW9fdHJhY2tfb2JqLCBhb190cmFja192LCBhb190cmFja193aGVuLCBhb19kZWZlcl93aGVuIGFzIGFvX3doZW4sIGFvX3hmb3JtLCBhb2dfZmVuY2VfeGYsIGFvZ19nYXRlZCwgYW9nX2l0ZXIsIGFvZ19zaW5rLCBhc19pdGVyX3Byb3RvLCBpc19hb19mbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImltcG9ydCB7YXNzZXJ0LCBpc19mbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5pbXBvcnQge2FvX2RlZmVyX28sIGFvX2RlZmVyX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX2ZlbmNlX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX2lufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtpdGVyLCBzdGVwX2l0ZXIsIGFvX2l0ZXIsIGFvX3N0ZXBfaXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcblxuZGVzY3JpYmUgQCAnc21va2UnLCBAOjpcbiAgaXQgQCAnZGVmZXInLCBAOjpcbiAgICBpc19mbiBAIGFvX2RlZmVyX29cbiAgICBpc19mbiBAIGFvX2RlZmVyX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfaW5cblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4iLCJpbXBvcnQge2FvX2RlZmVyX28sIGFvX2RlZmVyX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVyX28nLCBAOjpcblxuICBkZXNjcmliZSBAICdhb19kZWZlcl92IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVyX28gb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyX28oKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJfbygpXG4gICAgICBsZXQgcCA9IHJlcy5wcm9taXNlXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcl9vKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4oZylcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBpdCBAICdhb19zcGxpdCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3Mud2hlbl9ydW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgaXQgQCAnYW9fdGFwIHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgW2Zfb3V0LCBhZ190YXBdID0gYW9fdGFwKGcpXG4gICAgICBpc19hc3luY19pdGVyYWJsZSBAIGZfb3V0XG4gICAgICBpc19nZW4gQCBhZ190YXBcblxuICAgICAgZXhwZWN0KGZfb3V0LmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZl9vdXQuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dClcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFnX3RhcClcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX3RyYWNrX3YsIGFvX3RyYWNrfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX3RyYWNrJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fdHJhY2tfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb190cmFja192KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpXG4gICAgICBleHBlY3QocmVzKS50by5oYXZlLmxlbmd0aCg1KVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzNdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzRdKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgLy8gZnV0dXJlIGFuZCBjdXJyZW50IHN0YXJ0IG91dCB0aGUgc2FtZVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uZXF1YWwocmVzWzRdKVxuXG4gICAgaXQgQCAndHJhY2sgZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IHZ0ID0gYW9fdHJhY2tfdigpXG4gICAgICBjb25zdCBbcHRpcCwgcmVzdW1lLCBhYm9ydCwgZmVuY2VdID0gdnRcblxuICAgICAgLy8gdW50aWwgZmlyc3QgcmVzdW1lLCBmZW5jZSBhbmQgdGlwIGFyZSB0aGUgc2FtZVxuICAgICAgbGV0IHBmMCA9IGZlbmNlKClcbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHB0aXApXG4gICAgICBsZXQgcGYxID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMSkudG8uZXF1YWwocGYwKVxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5lcXVhbChwZjEpXG5cbiAgICAgIGV4cGVjdCh2dFswXSkudG8uZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHZ0WzBdKVxuICAgICAgcmVzdW1lKDQyKSAvLyByYWNoZXQgZmlyc3QgcmVzb2x2ZWQgcHJvbWlzZSBmb3J3YXJkXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbCh2dFswXSlcbiAgICAgIGV4cGVjdCh2dFswXSkudG8uZXF1YWwocHRpcClcblxuICAgICAgbGV0IHBmMiA9IGZlbmNlKClcbiAgICAgIGV4cGVjdChwZjIpLnRvLm5vdC5lcXVhbChwZjEpXG4gICAgICBsZXQgcGYzID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMykudG8uZXF1YWwocGYyKVxuXG4gICAgICBleHBlY3QodnRbMF0pLnRvLmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QoZmVuY2UodHJ1ZSkpLnRvLmVxdWFsKHBmMylcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHZ0WzBdKVxuICAgICAgcmVzdW1lKDE5NDIpIC8vIHJhY2hldCBmaXJzdCByZXNvbHZlZCBwcm9taXNlIGZvcndhcmRcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHZ0WzBdKVxuICAgICAgZXhwZWN0KHZ0WzBdKS50by5ub3QuZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdCh2dFswXSkudG8uZXF1YWwocGYzKVxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5ub3QuZXF1YWwocGYzKVxuXG4gICAgICBsZXQgcGY0ID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmNCkudG8ubm90LmVxdWFsKHZ0WzBdKVxuICAgICAgZXhwZWN0KHBmNCkudG8ubm90LmVxdWFsKHBmMylcblxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5lcXVhbChwZjQpXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbCh2dFswXSlcbiAgICAgIFxuICAgICAgZXhwZWN0KGF3YWl0IHB0aXApLnRvLmVxdWFsKDQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYxKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjIpLnRvLmVxdWFsKDE5NDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYzKS50by5lcXVhbCgxOTQyKVxuXG5cbiAgICBpdCBAICd1c2UsIHJlc3VtZSB3aXRoIGZlbmNlKCknLCBAOjo+XG4gICAgICBjb25zdCBbcHRpcCwgcmVzdW1lLCBhYm9ydCwgZmVuY2VdID0gYW9fdHJhY2tfdigpXG4gICAgICByZXN1bWUoNDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwZjAgPSBmZW5jZSgpIC8vIGZpcnN0IHVzZSBvZiBmZW5jZSwgc2hvdWxkIGJlIHNhbWUgYXMgcHRpcFxuICAgICAgZXhwZWN0KHBmMCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocHRpcClcblxuICAgICAgbGV0IHBmMSA9IGZlbmNlKCkgLy8gc2Vjb25kIHVzZSBvZiBmZW5jZSwgc2hvdWxkIGJlIGRpZmZlcmVudCBmcm9tIHB0aXBcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMSkudG8uZXF1YWwocGYwKVxuXG4gICAgICByZXN1bWUoMTk0MikgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgZXhwZWN0KGF3YWl0IHB0aXApLnRvLmVxdWFsKDQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMCkudG8uZXF1YWwoMTk0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjEpLnRvLmVxdWFsKDE5NDIpXG5cbiAgICBpdCBAICd1c2UsIGFib3J0IHdpdGggZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwdGlwLCByZXN1bWUsIGFib3J0LCBmZW5jZV0gPSBhb190cmFja192KClcbiAgICAgIGV4cGVjdChmZW5jZShmYWxzZSkpLnRvLmVxdWFsKHB0aXApXG5cbiAgICAgIGFib3J0KG5ldyBFcnJvcignbm9wZScpKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcblxuICAgICAgbGV0IHBmMCA9IGZlbmNlKClcbiAgICAgIGV4cGVjdChwZjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChmZW5jZSh0cnVlKSkudG8uZXF1YWwocGYwKVxuXG4gICAgICBsZXQgcGYxID0gZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYxKS50by5lcXVhbChwZjApXG4gICAgICBleHBlY3QoZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5lcXVhbChwZjEpXG5cbiAgICAgIGFib3J0KG5ldyBFcnJvcignbm90LCBhZ2FpbicpKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuICAgICAgZXhwZWN0KGZlbmNlKGZhbHNlKSkudG8uZXF1YWwocGYxKVxuICAgICAgZXhwZWN0KGZlbmNlKHRydWUpKS50by5ub3QuZXF1YWwocGYwKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcHRpcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZSAvLyBhd2FpdCBwdGlwXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3QsIGFnYWluJywgZXJyLm1lc3NhZ2UgLy8gYXdhaXQgcGYwXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjFcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3QsIGFnYWluJywgZXJyLm1lc3NhZ2UgLy8gYXdhaXQgcGYxXG5cblxuICBkZXNjcmliZSBAICdhb190cmFjayBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fdHJhY2soKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnRpcCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZXN1bWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuYWJvcnQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuZnRyKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGV4cGVjdChyZXMudGlwKCkpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5mdHIoKSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICAvLyBmdXR1cmUgYW5kIGN1cnJlbnQgc3RhcnQgb3V0IHRoZSBzYW1lXG4gICAgICBleHBlY3QocmVzLnRpcCgpKS50by5lcXVhbChyZXMuZnRyKCkpXG5cbiAgICBpdCBAICd1c2UsIHJlc3VtZSB3aXRoIGZlbmNlKCknLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb190cmFjaygpLCBwdGlwID0gcmVzLnRpcCgpXG4gICAgICByZXMucmVzdW1lKDQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBsZXQgcGYwID0gcmVzLmZlbmNlKCkgLy8gZmlyc3QgdXNlIG9mIGZlbmNlLCBzaG91bGQgYmUgc2FtZSBhcyBwdGlwXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjApLnRvLm5vdC5lcXVhbChwdGlwKVxuXG4gICAgICBsZXQgcGYxID0gcmVzLmZlbmNlKCkgLy8gc2Vjb25kIHVzZSBvZiBmZW5jZSwgc2hvdWxkIGJlIGRpZmZlcmVudCBmcm9tIHB0aXBcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMSkudG8uZXF1YWwocGYwKVxuXG4gICAgICByZXMucmVzdW1lKDE5NDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGV4cGVjdChhd2FpdCBwdGlwKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjApLnRvLmVxdWFsKDE5NDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYxKS50by5lcXVhbCgxOTQyKVxuXG4gICAgaXQgQCAndXNlLCBhYm9ydCB3aXRoIGZlbmNlKCknLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb190cmFjaygpLCBwdGlwID0gcmVzLnRpcCgpXG4gICAgICBleHBlY3QocmVzLmZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcblxuICAgICAgcmVzLmFib3J0KG5ldyBFcnJvcignbm9wZScpKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZShmYWxzZSkpLnRvLmVxdWFsKHB0aXApXG5cbiAgICAgIGxldCBwZjAgPSByZXMuZmVuY2UoKVxuICAgICAgZXhwZWN0KHBmMCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzLmZlbmNlKGZhbHNlKSkudG8uZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UodHJ1ZSkpLnRvLmVxdWFsKHBmMClcblxuICAgICAgbGV0IHBmMSA9IHJlcy5mZW5jZSgpXG4gICAgICBleHBlY3QocGYxKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmVxdWFsKHBmMClcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UoZmFsc2UpKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZSh0cnVlKSkudG8uZXF1YWwocGYxKVxuXG4gICAgICByZXMuYWJvcnQobmV3IEVycm9yKCdub3QsIGFnYWluJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG4gICAgICBleHBlY3QocmVzLmZlbmNlKGZhbHNlKSkudG8uZXF1YWwocGYxKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZSh0cnVlKSkudG8ubm90LmVxdWFsKHBmMClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHB0aXBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2UgLy8gYXdhaXQgcHRpcFxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcGYwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm90LCBhZ2FpbicsIGVyci5tZXNzYWdlIC8vIGF3YWl0IHBmMFxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcGYxXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm90LCBhZ2FpbicsIGVyci5tZXNzYWdlIC8vIGF3YWl0IHBmMVxuIiwiaW1wb3J0IHthb19mZW5jZV92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthc3NlcnQsIGV4cGVjdCwgZGVsYXlfcmFjZX0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3YgdHVwbGUnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfdigpXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ29ubHkgZmlyc3QgYWZ0ZXInLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG4gICAgbGV0IGYsIGZ6XG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndHdvJywgYXdhaXQgZlxuXG4gICAgcmVzdW1lIEAgJ2ZvdXInXG4gICAgcmVzdW1lIEAgJ2ZpdmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAnc2l4J1xuICAgIHJlc3VtZSBAICdzZXZlbidcblxuICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG5cblxuICBpdCBAICduZXZlciBibG9ja2VkIG9uIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuXG4gIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgbGV0IHYgPSAnYSdcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgY29uc3QgcCA9IEAhPlxuICAgICAgdiA9ICdiJ1xuXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnYmInKVxuXG4gICAgICB2ID0gJ2MnXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnY2MnKVxuICAgICAgdiA9ICdkJ1xuICAgICAgcmV0dXJuIDE5NDJcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2QnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2ZufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsIFxuICBpc19mZW5jZV9jb3JlLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfZm4nLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpc19mZW5jZV9jb3JlKHJlc1swXSlcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZS5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb2JqJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCByZXMgPSBhb19mZW5jZV9vYmooKVxuICAgIGV4cGVjdChyZXMuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnJlc3VtZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYWJvcnQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGlzX2ZlbmNlX2NvcmUgQCByZXNcblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19kZWZlcl93aGVuLCBhb193aGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX3doZW4gYW5kIGFvX2RlZmVyX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGV4cGVjdChhb193aGVuKS50by5lcXVhbChhb19kZWZlcl93aGVuKVxuXG4gICAgY29uc3QgcmVzID0gYW9fd2hlbigpXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgZXhwZWN0KHJlcy5oYXMpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmdldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuc2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWxldGUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlZmluZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3doZW4gbWFwLWxpa2Ugd2l0aCBkZWZlcnJlZCBwcm9taXNlcycsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb193aGVuKClcbiAgICBsZXQgcF9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KHBfZ2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChwX3NldCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAvLyBleHBlY3Qgc2FtZSB2YWx1ZVxuICAgIGV4cGVjdChwX3NldCkudG8uZXF1YWwocF9nZXQpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdzb21lLXZhbHVlJylcblxuICBpdCBAICd3aGVuIGRlZmVyZWQgbXVsdGlwbGUgc2V0JywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3doZW4oKVxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICBsZXQgcF9zZXQgPSByZXMuc2V0KCdzb21lLWtleScsICdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnYW5vdGhlci12YWx1ZScpXG5cbiAgICAvLyBleHBlY3QgZmlyc3QgdmFsdWVcbiAgICBleHBlY3QoYXdhaXQgcF9zZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICAvLyBleHBlY3QgZmlyc3QgdmFsdWVcbiAgICBleHBlY3QoYXdhaXQgcmVzLmdldCgnc29tZS1rZXknKSkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuIiwiaW1wb3J0IHthb190cmFja193aGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb190cmFja193aGVuJywgQDo6XG5cbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb190cmFja193aGVuKClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICBleHBlY3QocmVzLmhhcykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZ2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlbGV0ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVmaW5lKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnd2hlbiBtYXAtbGlrZSB3aXRoIGZlbmNlcycsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb190cmFja193aGVuKClcblxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfc2V0ID0gcmVzLnNldCgnc29tZS1rZXknLCAnc29tZS12YWx1ZScpXG4gICAgZXhwZWN0KHBfc2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KHBfc2V0KS50by5lcXVhbChwX2dldClcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ3NvbWUtdmFsdWUnKVxuXG5cbiAgaXQgQCAnd2hlbiB0cmFjayBjaGFuZ2VkJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3doZW4oKVxuXG4gICAgbGV0IHBfZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIHJlcy5zZXQoJ3NvbWUta2V5JywgJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICBsZXQgcF9nZXRfcHJlID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIHJlcy5zZXQoJ3NvbWUta2V5JywgJ2Fub3RoZXItdmFsdWUnKVxuICAgIGxldCBwX2dldF9wb3N0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldF9wcmUpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0X3Bvc3QpLnRvLmVxdWFsKCdhbm90aGVyLXZhbHVlJylcblxuIiwiaW1wb3J0IHthb19mZW5jZV93aGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV93aGVuJywgQDo6XG5cbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV93aGVuKClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICBleHBlY3QocmVzLmhhcykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZ2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlbGV0ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVmaW5lKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnd2hlbiBtYXAtbGlrZSB3aXRoIGZlbmNlcycsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV93aGVuKClcbiAgICBsZXQgZm5fZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIGV4cGVjdChmbl9nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGxldCBwX2dldCA9IGZuX2dldCgpXG4gICAgZXhwZWN0KHBfZ2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBmbl9zZXQgPSByZXMuc2V0KCdzb21lLWtleScsICdzb21lLXZhbHVlJylcbiAgICBleHBlY3QoZm5fc2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAvLyBleHBlY3Qgc2FtZSB2YWx1ZVxuICAgIGV4cGVjdChmbl9zZXQpLnRvLmVxdWFsKGZuX2dldClcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ3NvbWUtdmFsdWUnKVxuXG5cbiAgaXQgQCAnd2hlbiBmZW5jZSByZXNldCcsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV93aGVuKClcblxuICAgIGxldCBmbl9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG5cbiAgICBsZXQgcF9nZXQgPSBmbl9nZXQoKVxuICAgIHJlcy5zZXQoJ3NvbWUta2V5JywgJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICBsZXQgcF9nZXRfMiA9IGZuX2dldCgpIC8vIHJlc2V0XG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnYW5vdGhlci12YWx1ZScpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0XzIpLnRvLmVxdWFsKCdhbm90aGVyLXZhbHVlJylcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vdXQsIGFvX2l0ZXIsIGFvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLFxuICBpc19mZW5jZV9jb3JlLFxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb3V0JywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGlzX2ZlbmNlX2NvcmUgQCBhb19mZW5jZV9vdXQoKVxuICAgIGV4cGVjdChyZXMuYW9fYm91bmQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX3J1bikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYmluZF9nYXRlZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYWxsb3dfbWFueSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnY2hlY2sgbm90IGJvdW5kIGVycm9yJywgQDo6PlxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKVxuXG4gICAgdHJ5IDo6XG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBub3QgYm91bmQvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuXG4gIGl0IEAgJ2NoZWNrIGFscmVhZHkgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhc3NlcnQuZmFpbCBAICdzaG91bGQgaGF2ZSByZXR1cm5lZCBhbiBlcnJvcidcbiAgICBjYXRjaCBlcnIgOjpcbiAgICAgIGlmIC9hb19mZW5jZV9vdXQgY29uc3VtZWQ7Ly50ZXN0KGVyci5tZXNzYWdlKSA6OlxuICAgICAgICAvLyB3b3JrZWRcbiAgICAgIGVsc2UgdGhyb3cgZXJyXG5cbiAgaXQgQCAnYWxsb3dfbWFueSgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcblxuICBpdCBAICdhb19mb3JrKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fYm91bmQoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fYm91bmQoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX3J1bigpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgbGV0IHAgPSBmLmFvX3J1bigpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgIGV4cGVjdChmLndoZW5fcnVuKS50by5lcXVhbChwKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2lufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2ZlbmNlX2dlbixcbiAgZGVsYXlfcmFjZSwgZGVsYXlcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfZ2VuIEAgYW9fZmVuY2VfaW4oKVxuICAgIGV4cGVjdChyZXMuYW9feGZvcm0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX2ZvbGQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX3F1ZXVlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfaXRlcikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9nX3NpbmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzLnJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9feGZvcm0oKScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9waXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0oKVxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4cmVjdiBzdW0gcHJlIHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSBAOlxuICAgICAgKnhyZWN2KGcpIDo6XG4gICAgICAgIGxldCBzID0gMFxuICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHMgKz0gdlxuICAgICAgICAgIHlpZWxkIHNcblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDE5NDIrMjA0MiwgMTk0MisyMDQyKzIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4ZW1pdCBwb3N0IHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeGluaXQoZ19pbikgOjpcbiAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBzdGFydCdcbiAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICB0cnkgOjpcbiAgICAgICAgICB5aWVsZCAqIGdfaW4uYW9nX2l0ZXIoKVxuICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgc29tZV9waXBlLmdfaW4ucmV0dXJuKClcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgcmV0dXJuIHpcblxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9fZm9sZCgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX2ZvbGQoKVxuXG4gICAgaXNfZ2VuIEAgc29tZV9waXBlLmdfaW5cbiAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2ltcGxlJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQoKVxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4cmVjdiBzdW0gcHJlIHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgIGFzeW5jICogeGVtaXQoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hpbml0IGNvbnRleHQgZ19pbicsIEA6Oj5cbiAgICBsZXQgbG9nPVtdXG5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkIEA6XG4gICAgICAqeGluaXQoZ19pbikgOjpcbiAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBzdGFydCdcbiAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICB0cnkgOjpcbiAgICAgICAgICB5aWVsZCAqIGdfaW4uYW9nX2l0ZXIoKVxuICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgc29tZV9waXBlLmdfaW4ucmV0dXJuKClcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgcmV0dXJuIHpcblxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19pdGVyLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9fcXVldWUoKScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgaXNfZ2VuKHNvbWVfcXVldWUuZ19pbilcbiAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKClcblxuICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfaW4xID0gc29tZV9xdWV1ZS5nX2luLm5leHQgQCAnZmlyc3QnXG4gICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGV4cGVjdChhd2FpdCBwX291dDEpLnRvLmRlZXAuZXF1YWwgQDpcbiAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG4gIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUgQDpcbiAgICAgIGFzeW5jICogeHJlY3YoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCAxMDAwK3ZcblxuICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9xdWV1ZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICBzb21lX3F1ZXVlLmdfaW5cblxuICAgIGF3YWl0IHNvbWVfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgZXhwZWN0KGF3YWl0IG91dCkudG8uZGVlcC5lcXVhbCBAI1xuICAgICAgMTAyNSwgMTA1MCwgMTA3NSwgMTEwMFxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3NpbmssIGFvX2ZlbmNlX2l0ZXIsIGFvX2RyaXZlLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGRlbGF5X3JhY2UsIGRlbGF5X3dhbGssIGFycmF5X2Zyb21fYW9faXRlcixcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdmZW5jZV9iYXJlJywgZnVuY3Rpb24oKSA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3NpbmsoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcXVldWUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX2ZlbmNlX3NpbmsoKVxuXG4gICAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgICAgZXhwZWN0KHNvbWVfcXVldWUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuXG4gICAgICBsZXQgcF9vdXQxID0gYW9faXRlcihzb21lX3F1ZXVlKS5uZXh0KClcbiAgICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICAgIGV4cGVjdChwX2luMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChhd2FpdCBwX291dDEpLnRvLmRlZXAuZXF1YWwgQDpcbiAgICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgICBsZXQgZmlyc3RfcXVldWUgPSBhb19mZW5jZV9zaW5rKClcbiAgICAgIGxldCBzZWNvbmRfcXVldWUgPSBAISo+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmaXJzdF9xdWV1ZSA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNlY29uZF9xdWV1ZSlcblxuICAgICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMFxuICAgICAgICBmaXJzdF9xdWV1ZS5nX2luXG5cbiAgICAgIGF3YWl0IGZpcnN0X3F1ZXVlLmdfaW4ucmV0dXJuKClcblxuICAgICAgZXhwZWN0KGF3YWl0IG91dCkudG8uZGVlcC5lcXVhbCBAI1xuICAgICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cblxuICBkZXNjcmliZSBAICdhb19mZW5jZV9pdGVyKCknLCBmdW5jdGlvbigpIDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX2ZlbmNlX2l0ZXIoKVxuXG4gICAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2ltcGxlJywgQDo6PlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2l0ZXIoKVxuICAgICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgICBpdCBAICd4ZW1pdCBwb3N0IHRyYW5zZm9ybScsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgc2Vjb25kX3BpcGUgPSBAISo+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmaXJzdF9waXBlIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICAgIHNlY29uZF9waXBlLmdfaW4gPSBmaXJzdF9waXBlLmdfaW5cblxuICAgICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNlY29uZF9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uIF90ZXN0X3BpcGVfb3V0KHNvbWVfcGlwZSwgdmFsdWVzKSA6OlxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fcHVzaF9zdHJlYW0sIGFzX2l0ZXJfcHJvdG8sIGFvX2RyaXZlLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGRlbGF5X3JhY2UsIGRlbGF5X3dhbGssIGFycmF5X2Zyb21fYW9faXRlcixcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdmZW5jZV9zdHJlYW0nLCBmdW5jdGlvbigpIDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fcHVzaF9zdHJlYW0oKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfc3RyZWFtID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19wdXNoX3N0cmVhbSgpXG5cbiAgICAgIGV4cGVjdChzb21lX3N0cmVhbS5nX2luKS50by5iZS51bmRlZmluZWRcblxuICAgIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgICBsZXQgc29tZV9zdHJlYW0gPSBhb19wdXNoX3N0cmVhbSgpXG5cbiAgICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfc3RyZWFtKS5uZXh0KClcbiAgICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBzb21lX3N0cmVhbS5wdXNoIEAgJ2ZpcnN0J1xuICAgICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuXG4gICAgaXQgQCAndmVjJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3N0cmVhbSA9IGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgbGV0IHNlY29uZF9zdHJlYW0gPSBAISo+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmaXJzdF9zdHJlYW0gOjpcbiAgICAgICAgICB5aWVsZCAxMDAwK3ZcblxuICAgICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzZWNvbmRfc3RyZWFtKVxuXG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDAgOjpcbiAgICAgICAgZmlyc3Rfc3RyZWFtLnB1c2godilcblxuICAgICAgZmlyc3Rfc3RyZWFtLmFib3J0KClcblxuICAgICAgZXhwZWN0KGF3YWl0IG91dCkudG8uZGVlcC5lcXVhbCBAI1xuICAgICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9faW50ZXJ2YWwsIGFvX3RpbWVvdXQsIGFvX2RlYm91bmNlLCBhb190aW1lcywgYW9faXRlcl9mZW5jZWQsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAndGltZScsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9faW50ZXJ2YWxcbiAgICBpc19mbiBAIGFvX3RpbWVvdXRcbiAgICBpc19mbiBAIGFvX3RpbWVzXG5cblxuICBpdCBAICdhb19pbnRlcnZhbCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9faW50ZXJ2YWwoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX3RpbWVvdXQnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX3RpbWVvdXQoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX2RlYm91bmNlJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19kZWJvdW5jZSgxMCwgWzMwLCAyMCwgMTAsIDE1XSlcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgZXhwZWN0KGFvdC53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgYXNzZXJ0LmVxdWFsKDE1LCB2YWx1ZSlcblxuICAgIGF3YWl0IGFvdC53aGVuX3J1blxuXG5cbiAgaXQgQCAnYW9faXRlcl9mZW5jZWQgd2l0aCBhb19pbnRlcnZhbCBhcyByYXRlIGxpbWl0JywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEBcbiAgICAgIGFvX2l0ZXJfZmVuY2VkIEBcbiAgICAgICAgWzMwLCAyMCwgMTAsIDE1XVxuICAgICAgICBhb19pbnRlcnZhbCgxMClcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBleHBlY3QodmFsdWUpLnRvLmVxdWFsKDMwKVxuXG4gICAgbGV0IGxzdCA9IFt2YWx1ZV1cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgbHN0LnB1c2godilcblxuICAgIGV4cGVjdChsc3QpLnRvLmRlZXAuZXF1YWwgQFxuICAgICAgWzMwLCAyMCwgMTAsIDE1XVxuXG5cbiAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2ludGVydmFsKDEwKVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWU6IFt0czFdfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogW3RzMl19ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fYW5pbWF0aW9uLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gYW5pbWF0aW9uIGZyYW1lcycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2FuaW1hdGlvblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDo6XG5cbiAgICBpdCBAICdhb19kb21fYW5pbWF0aW9uJywgQDo6PlxuICAgICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2FuaW1hdGlvbigpXG4gICAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh2YWx1ZSA+PSAwKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcblxuICAgIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2RvbV9hbmltYXRpb24oKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9saXN0ZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBhcnJheV9mcm9tX2FvX2l0ZXJcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gZXZlbnRzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fbGlzdGVuXG5cbiAgICBsZXQgZGUgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9saXN0ZW4oKVxuICAgIGlzX2dlbiBAIGRlLmdfaW5cbiAgICBpc19mbiBAIGRlLndpdGhfZG9tXG5cblxuICBpdCBAICdzaGFwZSBvZiB3aXRoX2RvbScsIEA6OlxuICAgIGxldCBtb2NrID0gQHt9XG4gICAgICBhZGRFdmVudExpc3RlbmVyKGV2dCwgZm4sIG9wdCkgOjpcblxuICAgIGxldCBlX2N0eCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgLndpdGhfZG9tKG1vY2spXG5cbiAgICBpc19mbiBAIGVfY3R4LndpdGhfZG9tXG4gICAgaXNfZm4gQCBlX2N0eC5saXN0ZW5cblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgOjpcblxuICAgIGl0IEAgJ21lc3NhZ2UgY2hhbm5lbHMnLCBAOjo+XG4gICAgICBjb25zdCB7cG9ydDEsIHBvcnQyfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpXG5cbiAgICAgIGNvbnN0IGFvX3RndCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYW9fdGd0KVxuXG4gICAgICBhb190Z3RcbiAgICAgICAgLndpdGhfZG9tIEAgcG9ydDIsIHZvaWQgcG9ydDIuc3RhcnQoKVxuICAgICAgICAubGlzdGVuIEAgJ21lc3NhZ2UnLCBldnQgPT4gQDogdGVzdF9uYW1lOiBldnQuZGF0YVxuXG4gICAgICA6OiE+XG4gICAgICAgIGZvciBsZXQgbSBvZiBbJ2EnLCAnYicsICdjJ10gOjpcbiAgICAgICAgICBwb3J0MS5wb3N0TWVzc2FnZSBAIGBmcm9tIG1zZyBwb3J0MTogJHttfWBcbiAgICAgICAgICBhd2FpdCBkZWxheSgxKVxuXG4gICAgICAgIGFvX3RndC5nX2luLnJldHVybigpXG4gICAgICAgIHBvcnQxLmNsb3NlKClcblxuICAgICAgbGV0IGV4cGVjdGVkID0gQFtdXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYSdcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBiJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGMnXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsKGV4cGVjdGVkKVxuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0VBQUEsbUNBQW1DLE1BQU07OztJQUl2QyxZQUFhO01BQ1gsV0FBWSxPQUFROzs7SUFHdEIsY0FBZTs7O0lBR2Y7ZUFDUztNQUNQO01BQ0E7OztJQUdGLG1CQUFtQixVQUFVO0lBQzdCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBOztJQUVBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ25ERixNQUFNLFVBQVUsR0FBRyxDQUFDO0VBQ3BCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbEM7RUFDQSxNQUFNLFFBQVEsR0FBRyxJQUFJO0VBQ3JCLEVBQUUsVUFBVSxLQUFLLE9BQU8sSUFBSTtFQUM1QixPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCO0FBQ0E7RUFDQSxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDL0MsTUFBTSxhQUFhLEdBQUcsR0FBRyxJQUFJO0VBQzdCLEVBQUUsSUFBSSxHQUFHLEtBQUssT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7RUFDOUMsSUFBSSxNQUFNLEdBQUcsQ0FBQztFQUNkLEVBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQztBQUNmO0FBQ0E7RUFDQSxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTTtFQUNoQyxFQUFFLFNBQVMsS0FBSyxJQUFJLEdBQUcsTUFBTTtFQUM3QixJQUFJ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SUFBSSxDQUFDLENBQUM7RUFDUjtFQUNBLEVBQUUsSUFBSSxLQUFLLEdBQUcsR0FBRztFQUNqQixJQUFJLEtBQUssR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUMxQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUM3QztFQUNBO0VBQ0EsRUFBRSxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNwQztFQUNBO0VBQ0EsRUFBRSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUM7QUFDL0M7RUFDQTtFQUNBLEVBQUUsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNuRDtFQUNBLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtFQUNyQjtFQUNBO0VBQ0EsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUM3QixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEIsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ2Q7QUFDQTtF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
