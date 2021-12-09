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

  function ao_when_map(ao_fn_v, db=new Map()) {
    return {
      has: k => db.has(k)
    , get: k => at(k)[0]
    , set: define, define
    , delete(k) {
        let r, e = db.get(k);
        if (r = (undefined !== e)) {
          db.delete(k);
          e[1]();}
        return r} }

    function at(k, ) {
      let e = db.get(k);
      if (undefined === e) {
        db.set(k, e=ao_fn_v());}
      return e}

    function define(k, v) {
      let [r, fn] = at(k);
      fn(v); // e.g. deferred resolve or fence resume()
      return r} }

  function ao_defer_ctx(as_res = (...args) => args) {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , as_res(p, y, n)) }

  const ao_defer_v = /* #__PURE__ */
    ao_defer_ctx();

  const ao_defer = /* #__PURE__ */
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


  const ao_fence_obj = 
    () => ao_fence_o(_ao_fence_core_api_);

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

  function ao_track(proto, step) {
    let r = ao_track_v();
    return {__proto__: proto,
      tip: () => r[0]
    , resume: r[1]
    , abort: r[2]
    , fence: r[3]} }

  function ao_track_v(reset_v = ()=>ao_defer_v()) {
    // like ao_defer_v() and resetable like ao_fence_v()
    let p, r, x=reset_v();
    let fence = tip => p=(!tip || p===x[0] || p===r[0] ? x[0] : r[0]);
    let resume = ans => xz(x[1], ans);
    let abort  = err => xz(x[2], err || ao_done);
    // match ao_defer_v() of [promise, resolve, reject]
    return r = [ x[0], resume, abort, fence ]

    function xz(xf, v) {
      // 1. update current / tip: r[0] = x[0]
      // 2. re-prime fence: x = reset_v(r[0]]
      x = reset_v(r[0] = x[0]);
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
    let tid, [_fence, _resume] = ao_fence_fn(timeout);
    return timeout

    function timeout() {
      tid = setTimeout(_resume, ms, 1);
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
          tid = setTimeout(_resume, ms, v);}

        await p;}
      catch (err) {
        ao_check_done(err);} })());

    return _fence}


  async function * ao_times(ao_iterable) {
    let ts0 = Date.now();
    for await (let v of ao_iterable) {
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
      is_fn(ao_defer);
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

  describe('core ao_defer', (() => {

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



    describe('ao_defer object', (() => {
      it('shape', (() => {
        const res = ao_defer();
        expect(res).to.be.an('object');
        expect(res.promise).to.be.a('promise');
        expect(res.resolve).to.be.a('function');
        expect(res.reject).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const res = ao_defer();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const res = ao_defer();
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
        expect(res).to.have.length(4);
        expect(res[0]).to.be.a('promise');
        expect(res[1]).to.be.a('function');
        expect(res[2]).to.be.a('function');
        expect(res[3]).to.be.a('function');}) );

      it('use, resume with fence()', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        resume(42); // create difference for tip and fence

        let pf0 = fence();
        let pf1 = fence();

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.not.equal(ptip);
        expect(pf0).to.equal(pf1);

        resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(1942);
        expect(await pf1).to.equal(1942);}) );

      it('use, resume with fence(true)', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        resume(42); // create difference for tip and fence

        let pf0 = fence(true);
        let pf1 = fence(true);

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.equal(ptip);
        expect(pf0).to.not.equal(pf1);

        resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(42);
        expect(await pf1).to.equal(1942);}) );


      it('use, abort with fence()', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        abort(new Error('nope')); // create difference for tip and fence

        let pf0 = fence();
        let pf1 = fence();

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.not.equal(ptip);
        expect(pf0).to.equal(pf1);

        abort(new Error('not, again')); // create difference for tip and fence

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); }

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); } }) );

      it('use, abort with fence(true)', (async () => {
        const [ptip, resume, abort, fence] = ao_track_v();
        abort(new Error('nope')); // create difference for tip and fence

        let pf0 = fence(true);
        let pf1 = fence(true);

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.equal(ptip);
        expect(pf0).to.not.equal(pf1);

        abort(new Error('not, again')); // create difference for tip and fence

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); } }) ); }) );


    describe('ao_track object', (() => {
      it('shape', (() => {
        const res = ao_track();
        expect(res).to.be.an('object');
        expect(res.tip).to.be.a('function');
        expect(res.resume).to.be.a('function');
        expect(res.abort).to.be.a('function');
        expect(res.fence).to.be.a('function');}) );

      it('use, resume with fence()', (async () => {
        const res = ao_track();
        res.resume(42); // create difference for tip and fence

        let ptip = res.tip();
        let pf0 = res.fence();
        let pf1 = res.fence();

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.not.equal(ptip);
        expect(pf0).to.equal(pf1);

        res.resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(1942);
        expect(await pf1).to.equal(1942);}) );

      it('use, resume with fence(true)', (async () => {
        const res = ao_track();
        res.resume(42); // create difference for tip and fence

        let ptip = res.tip();
        let pf0 = res.fence(true);
        let pf1 = res.fence(true);

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.equal(ptip);
        expect(pf0).to.not.equal(pf1);

        res.resume(1942); // create difference for tip and fence

        expect(await ptip).to.equal(42);
        expect(await pf0).to.equal(42);
        expect(await pf1).to.equal(1942);}) );


      it('use, abort with fence()', (async () => {
        const res = ao_track();
        res.abort(new Error('nope')); // create difference for tip and fence

        let ptip = res.tip();
        let pf0 = res.fence();
        let pf1 = res.fence();

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.not.equal(ptip);
        expect(pf0).to.equal(pf1);

        res.abort(new Error('not, again')); // create difference for tip and fence

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); }

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); } }) );

      it('use, abort with fence(true)', (async () => {
        const res = ao_track();
        res.abort(new Error('nope')); // create difference for tip and fence

        let ptip = res.tip();
        let pf0 = res.fence(true);
        let pf1 = res.fence(true);

        expect(ptip).to.be.a('promise');
        expect(pf0).to.be.a('promise');
        expect(pf1).to.be.a('promise');

        expect(pf0).to.equal(ptip);
        expect(pf0).to.not.equal(pf1);

        res.abort(new Error('not, again')); // create difference for tip and fence

        try {
          await ptip;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf0;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); }

        try {
          await pf1;
          assert.fail();}
        catch (err) {
          assert.equal('not, again', err.message); } }) ); }) ); }) );

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

        let {value: ts1} = await p;
        assert(ts1 >= 0);

        let {value: ts2} = await g.next();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvdHJhY2suanN5IiwiLi4vdW5pdC9mZW5jZV92LmpzeSIsIi4uL3VuaXQvZmVuY2VfZm4uanN5IiwiLi4vdW5pdC9mZW5jZV9vYmouanN5IiwiLi4vdW5pdC93aGVuX2RlZmVyLmpzeSIsIi4uL3VuaXQvd2hlbl90cmFjay5qc3kiLCIuLi91bml0L3doZW5fZmVuY2UuanN5IiwiLi4vdW5pdC9mZW5jZV9vdXQuanN5IiwiLi4vdW5pdC9mZW5jZV9pbi5qc3kiLCIuLi91bml0L3hmb3JtLmpzeSIsIi4uL3VuaXQvZm9sZC5qc3kiLCIuLi91bml0L3F1ZXVlLmpzeSIsIi4uL3VuaXQvZmVuY2VfYmFyZS5qc3kiLCIuLi91bml0L2ZlbmNlX3N0cmVhbS5qc3kiLCIuLi91bml0L3RpbWUuanN5IiwiLi4vdW5pdC9kb21fYW5pbS5qc3kiLCIuLi91bml0L2RvbV9saXN0ZW4uanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgYXNzZXJ0LCBleHBlY3QgfSA9IHJlcXVpcmUoJ2NoYWknKVxuZXhwb3J0IEB7fSBhc3NlcnQsIGV4cGVjdFxuXG5leHBvcnQgY29uc3QgZGVsYXkgPSAobXM9MSkgPT4gXG4gIG5ldyBQcm9taXNlIEAgeSA9PlxuICAgIHNldFRpbWVvdXQgQCB5LCBtcywgJ3RpbWVvdXQnXG5cbmV4cG9ydCBjb25zdCBkZWxheV9yYWNlID0gKHAsIG1zPTEpID0+IFxuICBQcm9taXNlLnJhY2UgQCMgcCwgZGVsYXkobXMpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGRlbGF5X3dhbGsoZ19pbiwgbXM9MSkgOjpcbiAgYXdhaXQgZGVsYXkobXMpXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnX2luIDo6XG4gICAgeWllbGQgdlxuICAgIGF3YWl0IGRlbGF5KG1zKVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZm4oZm4pIDo6XG4gIGV4cGVjdChmbikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICByZXR1cm4gZm5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2dlbihnKSA6OlxuICBpc19mbihnLm5leHQpXG4gIGlzX2ZuKGcucmV0dXJuKVxuICBpc19mbihnLnRocm93KVxuICByZXR1cm4gZ1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmVuY2VfY29yZShmKSA6OlxuICBpc19mbihmLmZlbmNlKVxuICBpc19mbihmLmFvX2ZvcmspXG4gIGlzX2FzeW5jX2l0ZXJhYmxlKGYpXG5cbiAgaXNfZm4oZi5hb19jaGVja19kb25lKVxuICAvLyBpc19mbihmLmNoYWluKSAtLSBtb3ZlZCB0byBleHBlcmltZW50YWwvY2hhaW4ubWRcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2dlbihmKSA6OlxuICBpc19mZW5jZV9jb3JlKGYpXG4gIGlzX2ZuKGYuYWJvcnQpXG4gIGlzX2ZuKGYucmVzdW1lKVxuXG4gIGlzX2dlbihmKVxuICByZXR1cm4gZlxuXG5leHBvcnQgZnVuY3Rpb24gaXNfYXN5bmNfaXRlcmFibGUobykgOjpcbiAgYXNzZXJ0IEAgbnVsbCAhPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgJ2FzeW5jIGl0ZXJhYmxlJ1xuICByZXR1cm4gb1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXJyYXlfZnJvbV9hb19pdGVyKGcpIDo6XG4gIGxldCByZXMgPSBbXVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgIHJlcy5wdXNoKHYpXG4gIHJldHVybiByZXNcblxuIiwiY29uc3QgaXNfYW9faXRlciA9IGcgPT5cbiAgbnVsbCAhPSBnW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTtcblxuY29uc3QgaXNfYW9fZm4gPSB2X2ZuID0+XG4gICdmdW5jdGlvbicgPT09IHR5cGVvZiB2X2ZuXG4gICAgJiYgISBpc19hb19pdGVyKHZfZm4pO1xuXG5cbmNvbnN0IGFvX2RvbmUgPSBPYmplY3QuZnJlZXplKHthb19kb25lOiB0cnVlfSk7XG5jb25zdCBhb19jaGVja19kb25lID0gZXJyID0+IHtcbiAgaWYgKGVyciAhPT0gYW9fZG9uZSAmJiBlcnIgJiYgIWVyci5hb19kb25lKSB7XG4gICAgdGhyb3cgZXJyfVxuICByZXR1cm4gdHJ1ZX07XG5cblxuY29uc3QgX2FnX2NvcHkgPSAoe2dfaW59LCBhZ19vdXQpID0+KFxuICB1bmRlZmluZWQgPT09IGdfaW4gPyBhZ19vdXQgOihcbiAgICBhZ19vdXQuZ19pbiA9IGdfaW5cbiAgLCBhZ19vdXQpICk7XG5cbmZ1bmN0aW9uIGFvX3doZW5fbWFwKGFvX2ZuX3YsIGRiPW5ldyBNYXAoKSkge1xuICByZXR1cm4ge1xuICAgIGhhczogayA9PiBkYi5oYXMoaylcbiAgLCBnZXQ6IGsgPT4gYXQoaylbMF1cbiAgLCBzZXQ6IGRlZmluZSwgZGVmaW5lXG4gICwgZGVsZXRlKGspIHtcbiAgICAgIGxldCByLCBlID0gZGIuZ2V0KGspO1xuICAgICAgaWYgKHIgPSAodW5kZWZpbmVkICE9PSBlKSkge1xuICAgICAgICBkYi5kZWxldGUoayk7XG4gICAgICAgIGVbMV0oKTt9XG4gICAgICByZXR1cm4gcn0gfVxuXG4gIGZ1bmN0aW9uIGF0KGssICkge1xuICAgIGxldCBlID0gZGIuZ2V0KGspO1xuICAgIGlmICh1bmRlZmluZWQgPT09IGUpIHtcbiAgICAgIGRiLnNldChrLCBlPWFvX2ZuX3YoKSk7fVxuICAgIHJldHVybiBlfVxuXG4gIGZ1bmN0aW9uIGRlZmluZShrLCB2KSB7XG4gICAgbGV0IFtyLCBmbl0gPSBhdChrKTtcbiAgICBmbih2KTsgLy8gZS5nLiBkZWZlcnJlZCByZXNvbHZlIG9yIGZlbmNlIHJlc3VtZSgpXG4gICAgcmV0dXJuIHJ9IH1cblxuZnVuY3Rpb24gYW9fZGVmZXJfY3R4KGFzX3JlcyA9ICguLi5hcmdzKSA9PiBhcmdzKSB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgYXNfcmVzKHAsIHksIG4pKSB9XG5cbmNvbnN0IGFvX2RlZmVyX3YgPSAvKiAjX19QVVJFX18gKi9cbiAgYW9fZGVmZXJfY3R4KCk7XG5cbmNvbnN0IGFvX2RlZmVyID0gLyogI19fUFVSRV9fICovXG4gIGFvX2RlZmVyX2N0eCgocCx5LG4pID0+XG4gICAgKHtwcm9taXNlOiBwLCByZXNvbHZlOiB5LCByZWplY3Q6IG59KSk7XG5cbmNvbnN0IGFvX2RlZmVyX3doZW4gPSBkYiA9PlxuICBhb193aGVuX21hcChhb19kZWZlcl92LCBkYik7XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4pIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHt9IH1cblxuXG5hc3luYyBmdW5jdGlvbiBhb19kcml2ZShnZW5faW4sIGdlbl90Z3QsIGNsb3NlX3RndCkge1xuICBpZiAoaXNfYW9fZm4oZ2VuX3RndCkpIHtcbiAgICBnZW5fdGd0ID0gZ2VuX3RndCgpO1xuICAgIGdlbl90Z3QubmV4dCgpO31cblxuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgaWYgKGRvbmUpIHticmVha30gfVxuXG4gIGlmIChjbG9zZV90Z3QpIHtcbiAgICBhd2FpdCBnZW5fdGd0LnJldHVybigpO30gfVxuXG5cblxuZnVuY3Rpb24gKiBpdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGl0ZXJhYmxlKSB7XG4gIHJldHVybiAoeWllbGQgKiBpdGVyYWJsZSl9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9faXRlcl9mZW5jZWQoaXRlcmFibGUsIGZfZ2F0ZSwgaW5pdGlhbD1mYWxzZSkge1xuICBsZXQgZiA9IHRydWUgPT09IGluaXRpYWwgPyBmX2dhdGUuZmVuY2UoKSA6IGluaXRpYWw7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICBhd2FpdCBmO1xuICAgIHlpZWxkIHY7XG4gICAgZiA9IGZfZ2F0ZS5mZW5jZSgpO30gfVxuXG5cbmNvbnN0IGFvX2l0ZXJfZmVuY2VkID0gKC4uLmFyZ3MpID0+XG4gIF9hZ19jb3B5KGFyZ3NbMF0sIF9hb19pdGVyX2ZlbmNlZCguLi5hcmdzKSk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX28ocHJvdG8pIHtcbiAgbGV0IHIgPSBhb19mZW5jZV92KCk7XG4gIHJldHVybiB7X19wcm90b19fOiBwcm90byxcbiAgICBmZW5jZTogclswXSwgcmVzdW1lOiByWzFdLCBhYm9ydDogclsyXX0gfVxuXG5mdW5jdGlvbiBhb19mZW5jZV92KCkge1xuICBsZXQgeCwgcD0wO1xuICBsZXQgZmVuY2UgID0gKCkgPT4gKCAwIT09cCA/IHAgOiBwPSh4PWFvX2RlZmVyX3YoKSlbMF0gKTtcbiAgbGV0IHJlc3VtZSA9IGFucyA9PiB7IGlmICgwIT09cCkgeyBwPTA7IHhbMV0oYW5zKTsgfX07XG4gIGxldCBhYm9ydCAgPSBlcnIgPT4geyBpZiAoMCE9PXApIHsgcD0wOyB4WzJdKGVyciB8fCBhb19kb25lKTsgfX07XG4gIHJldHVybiBbZmVuY2UsIHJlc3VtZSwgYWJvcnRdIH1cblxuXG5jb25zdCBhb19mZW5jZV93aGVuID0gZGIgPT5cbiAgYW9fd2hlbl9tYXAoYW9fZmVuY2VfdiwgZGIpO1xuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXJfZmVuY2UoZmVuY2UpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHIgPSBhd2FpdCBmZW5jZSgpO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gcikge1xuICAgICAgICB5aWVsZCByO30gfSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID0ge1xuICBhb19jaGVja19kb25lXG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSBhb19pdGVyX2ZlbmNlKHRoaXMuZmVuY2UpO1xuICAgIGxldCB7eGVtaXR9ID0gdGhpcztcbiAgICByZXR1cm4geGVtaXQgPyB4ZW1pdChhZykgOiBhZ30gfTtcblxuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9IFxuICAoKSA9PiBhb19mZW5jZV9vKF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuXG5cbmZ1bmN0aW9uIGFzX2l0ZXJfcHJvdG8ocmVzdW1lLCBhYm9ydCwgZG9uZSA9IHRydWUpIHtcbiAgcmV0dXJuIHtcbiAgICBuZXh0OiB2ID0+KHt2YWx1ZTogcmVzdW1lKHYpLCBkb25lfSlcbiAgLCByZXR1cm46ICgpID0+KHt2YWx1ZTogYWJvcnQoYW9fZG9uZSksIGRvbmV9KVxuICAsIHRocm93OiAoZXJyKSA9Pih7dmFsdWU6IGFib3J0KGVyciksIGRvbmV9KSB9IH1cblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmZ1bmN0aW9uIGFvX3RyYWNrKHByb3RvLCBzdGVwKSB7XG4gIGxldCByID0gYW9fdHJhY2tfdigpO1xuICByZXR1cm4ge19fcHJvdG9fXzogcHJvdG8sXG4gICAgdGlwOiAoKSA9PiByWzBdXG4gICwgcmVzdW1lOiByWzFdXG4gICwgYWJvcnQ6IHJbMl1cbiAgLCBmZW5jZTogclszXX0gfVxuXG5mdW5jdGlvbiBhb190cmFja192KHJlc2V0X3YgPSAoKT0+YW9fZGVmZXJfdigpKSB7XG4gIC8vIGxpa2UgYW9fZGVmZXJfdigpIGFuZCByZXNldGFibGUgbGlrZSBhb19mZW5jZV92KClcbiAgbGV0IHAsIHIsIHg9cmVzZXRfdigpO1xuICBsZXQgZmVuY2UgPSB0aXAgPT4gcD0oIXRpcCB8fCBwPT09eFswXSB8fCBwPT09clswXSA/IHhbMF0gOiByWzBdKTtcbiAgbGV0IHJlc3VtZSA9IGFucyA9PiB4eih4WzFdLCBhbnMpO1xuICBsZXQgYWJvcnQgID0gZXJyID0+IHh6KHhbMl0sIGVyciB8fCBhb19kb25lKTtcbiAgLy8gbWF0Y2ggYW9fZGVmZXJfdigpIG9mIFtwcm9taXNlLCByZXNvbHZlLCByZWplY3RdXG4gIHJldHVybiByID0gWyB4WzBdLCByZXN1bWUsIGFib3J0LCBmZW5jZSBdXG5cbiAgZnVuY3Rpb24geHooeGYsIHYpIHtcbiAgICAvLyAxLiB1cGRhdGUgY3VycmVudCAvIHRpcDogclswXSA9IHhbMF1cbiAgICAvLyAyLiByZS1wcmltZSBmZW5jZTogeCA9IHJlc2V0X3YoclswXV1cbiAgICB4ID0gcmVzZXRfdihyWzBdID0geFswXSk7XG4gICAgeGYodik7IH0gfS8vIHJlc3VtZS9hYm9ydCByWzBdIGN1cnJlbnQgLyB0aXBcblxuY29uc3QgYW9fdHJhY2tfd2hlbiA9IGRiID0+XG4gIGFvX3doZW5fbWFwKGFvX3RyYWNrX3YsIGRiKTtcblxuY29uc3QgYW9fZmVuY2Vfb3V0ID0gLyogI19fUFVSRV9fICovIGFvX2ZlbmNlX28uYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19ib3VuZCgpfVxuLCBhb19ib3VuZCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FvX2ZlbmNlX291dCBub3QgYm91bmQnKX1cbiwgX2FvX21hbnkoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgY29uc3VtZWQ7IGNvbnNpZGVyIC5hb19mb3JrKCkgb3IgLmFsbG93X21hbnkoKScpfVxuXG4sIGFsbG93X21hbnkoKSB7XG4gICAgbGV0IHthb19mb3JrLCBhb19ib3VuZCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICBpZiAoX2FvX21hbnkgPT09IGFvX2JvdW5kKSB7XG4gICAgICB0aGlzLmFvX2JvdW5kID0gYW9fZm9yazt9XG4gICAgdGhpcy5fYW9fbWFueSA9IGFvX2Zvcms7XG4gICAgdGhpcy5hbGxvd19tYW55ID0gKCkgPT4gdGhpcztcbiAgICByZXR1cm4gdGhpc31cblxuLCBhb19ydW4oKSB7XG4gICAgbGV0IHt3aGVuX3J1bn0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHdoZW5fcnVuKSB7XG4gICAgICB0aGlzLndoZW5fcnVuID0gd2hlbl9ydW4gPVxuICAgICAgICBhb19ydW4odGhpcy5hb19ib3VuZCgpKTsgfVxuICAgIHJldHVybiB3aGVuX3J1bn1cblxuLCBiaW5kX2dhdGVkKGZfZ2F0ZSkge1xuICAgIGxldCBhZ19vdXQgPSB0aGlzLl9hb19nYXRlZChmX2dhdGUpO1xuICAgIGFnX291dC5mX291dCA9IHRoaXM7XG4gICAgYWdfb3V0LmdfaW4gPSB0aGlzLmdfaW47XG4gICAgdGhpcy5hb19ib3VuZCA9ICgoKSA9PiB7XG4gICAgICBsZXQge3hlbWl0LCBfYW9fbWFueX0gPSB0aGlzO1xuICAgICAgdGhpcy5hb19ib3VuZCA9IF9hb19tYW55O1xuICAgICAgcmV0dXJuIHhlbWl0XG4gICAgICAgID8gX2FnX2NvcHkoYWdfb3V0LCB4ZW1pdChhZ19vdXQpKVxuICAgICAgICA6IGFnX291dH0pO1xuXG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fZ2F0ZWQoZl9nYXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuYmluZF9nYXRlZChmX2dhdGUpLmFvX2JvdW5kKCl9XG5cbiwgX2FvX2dhdGVkKGZfZ2F0ZSkge3JldHVybiBhb2dfZ2F0ZWQodGhpcywgZl9nYXRlKX0gfSApO1xuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX2dhdGVkKGZfb3V0LCBmX2dhdGUpIHtcbiAgdHJ5IHtcbiAgICBmX291dC5yZXN1bWUoKTtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHYgPSBhd2FpdCBmX2dhdGUuZmVuY2UoKTtcbiAgICAgIHlpZWxkIHY7XG4gICAgICBmX291dC5yZXN1bWUodik7fSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX291dC5hYm9ydCgpO1xuICAgIGlmIChmX2dhdGUuYWJvcnQpIHtcbiAgICAgIGZfZ2F0ZS5hYm9ydCgpO30gfSB9XG5cbmNvbnN0IGFvX2ZlZWRlciA9ICh7Z19pbn0pID0+IHYgPT4gZ19pbi5uZXh0KHYpO1xuY29uc3QgYW9fZmVlZGVyX3YgPSAoe2dfaW59KSA9PiAoLi4uYXJncykgPT4gZ19pbi5uZXh0KGFyZ3MpO1xuXG5cbmZ1bmN0aW9uIGFvZ19mZW5jZV94Zih4aW5pdCwgLi4uYXJncykge1xuICBsZXQgZl9pbiA9IGFvX2ZlbmNlX28oKSwgZl9vdXQgPSBhb19mZW5jZV9vKCk7XG4gIGxldCBnX2luID0geGluaXQoZl9pbiwgZl9vdXQsIC4uLmFyZ3MpO1xuICBnX2luLm5leHQoKTtcblxuICBsZXQgcmVzID0gYW9nX2dhdGVkKGZfb3V0LCBmX2luKTtcbiAgcmVzLmZlbmNlID0gZl9vdXQuZmVuY2U7XG4gIHJlcy5nX2luID0gZ19pbjtcbiAgcmV0dXJuIHJlc31cblxuZnVuY3Rpb24gYW9fZmVuY2VfaXRlciguLi5hcmdzKSB7XG4gIHJldHVybiBhb2dfZmVuY2VfeGYoYW9nX2l0ZXIsIC4uLmFyZ3MpfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9zaW5rKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGFvZ19mZW5jZV94Zihhb2dfc2luaywgLi4uYXJncyl9XG5cblxuZnVuY3Rpb24gKiBhb2dfaXRlcihmX2luLCBmX2dhdGUsIHhmKSB7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9ICh4Zi5uZXh0KHRpcCkpLnZhbHVlO31cbiAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgIHtcbiAgICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgICAgIHRpcCA9IChhd2FpdCB4Zi5uZXh0KHRpcCkpLnZhbHVlO31cbiAgICAgICAgZl9pbi5yZXN1bWUodGlwKTt9XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGZfZ2F0ZSkge1xuICAgICAgICBhd2FpdCBmX2dhdGUuZmVuY2UoKTt9IH0gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBmX2luLmFib3J0KCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cbmNvbnN0IGFvX3hmb3JtID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0obnNfZ2VuKTtcbmNvbnN0IGFvX2ZvbGQgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19mb2xkKG5zX2dlbik7XG5jb25zdCBhb19xdWV1ZSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKG5zX2dlbik7XG5cbmNvbnN0IGFvX2ZlbmNlX2luID0gLyogI19fUFVSRV9fICovIGFvX2ZlbmNlX28uYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgYW9fZm9sZChuc19nZW4pIHtyZXR1cm4gdGhpcy5hb194Zm9ybSh7eGluaXQ6IGFvZ19pdGVyLCAuLi4gbnNfZ2VufSl9XG4sIGFvX3F1ZXVlKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KX1cblxuLCBhb2dfaXRlcih4Zikge3JldHVybiBhb2dfaXRlcih0aGlzKX1cbiwgYW9nX3NpbmsoZl9nYXRlLCB4Zikge3JldHVybiBhb2dfc2luayh0aGlzLCBmX2dhdGUsIHhmKX1cblxuLCBhb194Zm9ybShuc19nZW49e30pIHtcbiAgICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vdXQoKTtcblxuICAgIGxldCB7eGVtaXQsIHhpbml0LCB4cmVjdn0gPVxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4ZW1pdCkge1xuICAgICAgZl9vdXQueGVtaXQgPSB4ZW1pdDt9XG5cbiAgICBpZiAoISB4aW5pdCkge3hpbml0ID0gYW9nX3Npbms7fVxuICAgIGxldCByZXMgPSB4aW5pdCh0aGlzLCBmX291dCxcbiAgICAgIHhyZWN2ID8gX3hmX2dlbi5jcmVhdGUoeHJlY3YpIDogdW5kZWZpbmVkKTtcblxuICAgIGxldCBnX2luID0gZl9vdXQuZ19pbiA9IHJlcy5nX2luIHx8IHJlcztcbiAgICByZXR1cm4gcmVzICE9PSBnX2luXG4gICAgICA/IHJlcyAvLyByZXMgaXMgYW4gb3V0cHV0IGdlbmVyYXRvclxuICAgICAgOigvLyByZXMgaXMgYW4gaW5wdXQgZ2VuZXJhdG9yXG4gICAgICAgICAgZ19pbi5uZXh0KCksXG4gICAgICAgICAgZl9vdXQuYmluZF9nYXRlZCh0aGlzKSkgfVxuXG4sIC8vIEVTMjAxNSBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9ICk7XG5cblxuY29uc3QgX3hmX2dlbiA9IHtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX3B1c2hfc3RyZWFtKGFzX3ZlYykge1xuICBsZXQgcT1bXSwgW2ZlbmNlLCByZXN1bWUsIGFib3J0XSA9IGFvX2ZlbmNlX3YoKTtcbiAgbGV0IHN0cmVhbSA9IGFvX3N0cmVhbV9mZW5jZShmZW5jZSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oc3RyZWFtLHtcbiAgICBzdHJlYW1cbiAgLCBhYm9ydFxuICAsIHB1c2goLi4uIGFyZ3MpIHtcbiAgICAgIGlmICh0cnVlID09PSBhc192ZWMpIHtcbiAgICAgICAgcS5wdXNoKGFyZ3MpO31cbiAgICAgIGVsc2UgcS5wdXNoKC4uLiBhcmdzKTtcblxuICAgICAgcmVzdW1lKHEpO1xuICAgICAgcmV0dXJuIHEubGVuZ3RofSB9ICkgfVxuXG5cbmZ1bmN0aW9uIGFvX3N0cmVhbV9mZW5jZShmZW5jZSkge1xuICBsZXQgW3doZW5fZG9uZSwgcmVzX2RvbmUsIHJlal9kb25lXSA9IGFvX2RlZmVyX3YoKTtcbiAgbGV0IHJlcyA9IF9hb19zdHJlYW1fZmVuY2UoZmVuY2UsIHJlc19kb25lLCByZWpfZG9uZSk7XG4gIHJlcy53aGVuX2RvbmUgPSB3aGVuX2RvbmU7XG4gIHJldHVybiByZXN9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fc3RyZWFtX2ZlbmNlKGZlbmNlLCByZXNvbHZlLCByZWplY3QpIHtcbiAgdHJ5IHtcbiAgICBsZXQgcF9yZWFkeSA9IGZlbmNlKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCBiYXRjaCA9IGF3YWl0IHBfcmVhZHk7XG4gICAgICBiYXRjaCA9IGJhdGNoLnNwbGljZSgwLCBiYXRjaC5sZW5ndGgpO1xuXG4gICAgICBwX3JlYWR5ID0gZmVuY2UoKTtcbiAgICAgIHlpZWxkICogYmF0Y2g7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGlmICghZXJyIHx8IGVyci5hb19kb25lKSB7XG4gICAgICByZXNvbHZlKHRydWUpO31cbiAgICBlbHNlIHJlamVjdChlcnIpO30gfVxuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwKSB7XG4gIGxldCBbX2ZlbmNlLCBfcmVzdW1lLCBfYWJvcnRdID0gYW9fZmVuY2VfZm4oKTtcbiAgbGV0IHRpZCA9IHNldEludGVydmFsKF9yZXN1bWUsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfYWJvcnQoKTt9KTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHRpbWVvdXQpO1xuICByZXR1cm4gdGltZW91dFxuXG4gIGZ1bmN0aW9uIHRpbWVvdXQoKSB7XG4gICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGFvX2l0ZXJhYmxlKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2Uud2hlbl9ydW4gPSAoKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgbGV0IHA7XG4gICAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGFvX2l0ZXJhYmxlKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgICBwID0gX2ZlbmNlKCk7XG4gICAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIHYpO31cblxuICAgICAgYXdhaXQgcDt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGFvX2l0ZXJhYmxlKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGFvX2l0ZXJhYmxlKSB7XG4gICAgeWllbGQgRGF0ZS5ub3coKSAtIHRzMDt9IH1cblxuZnVuY3Rpb24gYW9fZG9tX2FuaW1hdGlvbigpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbihyYWYpO1xuICByYWYuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2FuY2VsQW5pbWF0aW9uRnJhbWUodGlkKTtcbiAgICByYWYuZG9uZSA9IHRydWU7fSk7XG5cbiAgcmV0dXJuIHJhZlxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc3VtZSk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IF9ldnRfaW5pdCA9IFByb21pc2UucmVzb2x2ZSh7dHlwZTonaW5pdCd9KTtcbmZ1bmN0aW9uIGFvX2RvbV9saXN0ZW4oc2VsZj1hb19xdWV1ZSgpKSB7XG4gIHJldHVybiBfYmluZC5zZWxmID0gc2VsZiA9e1xuICAgIF9fcHJvdG9fXzogc2VsZlxuICAsIHdpdGhfZG9tKGRvbSwgZm4pIHtcbiAgICAgIHJldHVybiBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgICAgOiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZG9tKX0gfVxuXG4gIGZ1bmN0aW9uIF9iaW5kKGRvbSwgZm5fZXZ0LCBmbl9kb20pIHtcbiAgICByZXR1cm4gZXZ0ID0+IHtcbiAgICAgIGxldCB2ID0gZm5fZXZ0XG4gICAgICAgID8gZm5fZXZ0KGV2dCwgZG9tLCBmbl9kb20pXG4gICAgICAgIDogZm5fZG9tKGRvbSwgZXZ0KTtcblxuICAgICAgaWYgKG51bGwgIT0gdikge1xuICAgICAgICBzZWxmLmdfaW4ubmV4dCh2KTt9IH0gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSB7XG4gIGxldCBfb25fZXZ0O1xuICBpZiAoaXNfYW9fZm4oZm4pKSB7XG4gICAgX2V2dF9pbml0LnRoZW4oXG4gICAgICBfb25fZXZ0ID0gX2JpbmQoZG9tLCB2b2lkIDAsIGZuKSk7IH1cblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBsZXQgb3B0LCBldnRfZm4gPSBfb25fZXZ0O1xuXG4gICAgICBsZXQgbGFzdCA9IGFyZ3MucG9wKCk7XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgZXZ0X2ZuID0gX2JpbmQoZG9tLCBsYXN0LCBfb25fZXZ0KTtcbiAgICAgICAgbGFzdCA9IGFyZ3MucG9wKCk7fVxuXG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGFyZ3MucHVzaChsYXN0KTt9XG4gICAgICBlbHNlIG9wdCA9IGxhc3Q7XG5cbiAgICAgIGZvciAobGV0IGV2dCBvZiBhcmdzKSB7XG4gICAgICAgIGRvbS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIGV2dCwgZXZ0X2ZuLCBvcHQpOyB9XG5cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZWN0eF9saXN0KSB7XG4gIGVjdHhfbGlzdCA9IEFycmF5LmZyb20oZWN0eF9saXN0LFxuICAgIGRvbSA9PiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pKTtcblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBmb3IgKGxldCBlY3R4IG9mIGVjdHhfbGlzdCkge1xuICAgICAgICBlY3R4Lmxpc3RlbiguLi5hcmdzKTt9XG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cbmV4cG9ydCB7IF9hZ19jb3B5LCBfYW9fZmVuY2VfY29yZV9hcGlfLCBfYW9faXRlcl9mZW5jZWQsIF9hb19ydW4sIF9hb190YXAsIGFvX2NoZWNrX2RvbmUsIGFvX2RlYm91bmNlLCBhb19kZWZlciwgYW9fZGVmZXJfY3R4LCBhb19kZWZlcl92LCBhb19kZWZlcl93aGVuLCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fbGlzdGVuLCBhb19kb25lLCBhb19kcml2ZSwgYW9fZmVlZGVyLCBhb19mZWVkZXJfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2luLCBhb19mZW5jZV9pdGVyLCBhb19mZW5jZV9vLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX291dCwgYW9fZmVuY2Vfc2luaywgYW9fZmVuY2VfdiwgYW9fZmVuY2Vfd2hlbiwgYW9fZm9sZCwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX2l0ZXJfZmVuY2UsIGFvX2l0ZXJfZmVuY2VkLCBhb19wdXNoX3N0cmVhbSwgYW9fcXVldWUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fc3RyZWFtX2ZlbmNlLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb190cmFjaywgYW9fdHJhY2tfdiwgYW9fdHJhY2tfd2hlbiwgYW9fZGVmZXJfd2hlbiBhcyBhb193aGVuLCBhb194Zm9ybSwgYW9nX2ZlbmNlX3hmLCBhb2dfZ2F0ZWQsIGFvZ19pdGVyLCBhb2dfc2luaywgYXNfaXRlcl9wcm90bywgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlciwgYW9fZGVmZXJfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcicsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJcbiAgICBpc19mbiBAIGFvX2RlZmVyX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfaW5cblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4iLCJpbXBvcnQge2FvX2RlZmVyLCBhb19kZWZlcl92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19kZWZlcicsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVyX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXIgb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5wcm9taXNlKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMucmVzb2x2ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZWplY3QpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4oZylcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBpdCBAICdhb19zcGxpdCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3Mud2hlbl9ydW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgaXQgQCAnYW9fdGFwIHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgW2Zfb3V0LCBhZ190YXBdID0gYW9fdGFwKGcpXG4gICAgICBpc19hc3luY19pdGVyYWJsZSBAIGZfb3V0XG4gICAgICBpc19nZW4gQCBhZ190YXBcblxuICAgICAgZXhwZWN0KGZfb3V0LmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZl9vdXQuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dClcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFnX3RhcClcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX3RyYWNrX3YsIGFvX3RyYWNrfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX3RyYWNrJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fdHJhY2tfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb190cmFja192KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpXG4gICAgICBleHBlY3QocmVzKS50by5oYXZlLmxlbmd0aCg0KVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzNdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc3VtZSB3aXRoIGZlbmNlKCknLCBAOjo+XG4gICAgICBjb25zdCBbcHRpcCwgcmVzdW1lLCBhYm9ydCwgZmVuY2VdID0gYW9fdHJhY2tfdigpXG4gICAgICByZXN1bWUoNDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwZjAgPSBmZW5jZSgpXG4gICAgICBsZXQgcGYxID0gZmVuY2UoKVxuXG4gICAgICBleHBlY3QocHRpcCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHBmMSlcblxuICAgICAgcmVzdW1lKDE5NDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGV4cGVjdChhd2FpdCBwdGlwKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjApLnRvLmVxdWFsKDE5NDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYxKS50by5lcXVhbCgxOTQyKVxuXG4gICAgaXQgQCAndXNlLCByZXN1bWUgd2l0aCBmZW5jZSh0cnVlKScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwdGlwLCByZXN1bWUsIGFib3J0LCBmZW5jZV0gPSBhb190cmFja192KClcbiAgICAgIHJlc3VtZSg0MikgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgbGV0IHBmMCA9IGZlbmNlKHRydWUpXG4gICAgICBsZXQgcGYxID0gZmVuY2UodHJ1ZSlcblxuICAgICAgZXhwZWN0KHB0aXApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KHBmMCkudG8uZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChwZjApLnRvLm5vdC5lcXVhbChwZjEpXG5cbiAgICAgIHJlc3VtZSgxOTQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBleHBlY3QoYXdhaXQgcHRpcCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYwKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjEpLnRvLmVxdWFsKDE5NDIpXG5cblxuICAgIGl0IEAgJ3VzZSwgYWJvcnQgd2l0aCBmZW5jZSgpJywgQDo6PlxuICAgICAgY29uc3QgW3B0aXAsIHJlc3VtZSwgYWJvcnQsIGZlbmNlXSA9IGFvX3RyYWNrX3YoKVxuICAgICAgYWJvcnQobmV3IEVycm9yKCdub3BlJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwZjAgPSBmZW5jZSgpXG4gICAgICBsZXQgcGYxID0gZmVuY2UoKVxuXG4gICAgICBleHBlY3QocHRpcCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHBmMSlcblxuICAgICAgYWJvcnQobmV3IEVycm9yKCdub3QsIGFnYWluJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwdGlwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3QsIGFnYWluJywgZXJyLm1lc3NhZ2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMVxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vdCwgYWdhaW4nLCBlcnIubWVzc2FnZVxuXG4gICAgaXQgQCAndXNlLCBhYm9ydCB3aXRoIGZlbmNlKHRydWUpJywgQDo6PlxuICAgICAgY29uc3QgW3B0aXAsIHJlc3VtZSwgYWJvcnQsIGZlbmNlXSA9IGFvX3RyYWNrX3YoKVxuICAgICAgYWJvcnQobmV3IEVycm9yKCdub3BlJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwZjAgPSBmZW5jZSh0cnVlKVxuICAgICAgbGV0IHBmMSA9IGZlbmNlKHRydWUpXG5cbiAgICAgIGV4cGVjdChwdGlwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocGYxKVxuXG4gICAgICBhYm9ydChuZXcgRXJyb3IoJ25vdCwgYWdhaW4nKSkgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHB0aXBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcGYxXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm90LCBhZ2FpbicsIGVyci5tZXNzYWdlXG5cblxuICBkZXNjcmliZSBAICdhb190cmFjayBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fdHJhY2soKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnRpcCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZXN1bWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuYWJvcnQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzdW1lIHdpdGggZmVuY2UoKScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrKClcbiAgICAgIHJlcy5yZXN1bWUoNDIpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwdGlwID0gcmVzLnRpcCgpXG4gICAgICBsZXQgcGYwID0gcmVzLmZlbmNlKClcbiAgICAgIGxldCBwZjEgPSByZXMuZmVuY2UoKVxuXG4gICAgICBleHBlY3QocHRpcCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocHRpcClcbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHBmMSlcblxuICAgICAgcmVzLnJlc3VtZSgxOTQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBleHBlY3QoYXdhaXQgcHRpcCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYwKS50by5lcXVhbCgxOTQyKVxuICAgICAgZXhwZWN0KGF3YWl0IHBmMSkudG8uZXF1YWwoMTk0MilcblxuICAgIGl0IEAgJ3VzZSwgcmVzdW1lIHdpdGggZmVuY2UodHJ1ZSknLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb190cmFjaygpXG4gICAgICByZXMucmVzdW1lKDQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBsZXQgcHRpcCA9IHJlcy50aXAoKVxuICAgICAgbGV0IHBmMCA9IHJlcy5mZW5jZSh0cnVlKVxuICAgICAgbGV0IHBmMSA9IHJlcy5mZW5jZSh0cnVlKVxuXG4gICAgICBleHBlY3QocHRpcCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QocGYwKS50by5lcXVhbChwdGlwKVxuICAgICAgZXhwZWN0KHBmMCkudG8ubm90LmVxdWFsKHBmMSlcblxuICAgICAgcmVzLnJlc3VtZSgxOTQyKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBleHBlY3QoYXdhaXQgcHRpcCkudG8uZXF1YWwoNDIpXG4gICAgICBleHBlY3QoYXdhaXQgcGYwKS50by5lcXVhbCg0MilcbiAgICAgIGV4cGVjdChhd2FpdCBwZjEpLnRvLmVxdWFsKDE5NDIpXG5cblxuICAgIGl0IEAgJ3VzZSwgYWJvcnQgd2l0aCBmZW5jZSgpJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fdHJhY2soKVxuICAgICAgcmVzLmFib3J0KG5ldyBFcnJvcignbm9wZScpKSAvLyBjcmVhdGUgZGlmZmVyZW5jZSBmb3IgdGlwIGFuZCBmZW5jZVxuXG4gICAgICBsZXQgcHRpcCA9IHJlcy50aXAoKVxuICAgICAgbGV0IHBmMCA9IHJlcy5mZW5jZSgpXG4gICAgICBsZXQgcGYxID0gcmVzLmZlbmNlKClcblxuICAgICAgZXhwZWN0KHB0aXApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocGYxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KHBmMCkudG8ubm90LmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QocGYwKS50by5lcXVhbChwZjEpXG5cbiAgICAgIHJlcy5hYm9ydChuZXcgRXJyb3IoJ25vdCwgYWdhaW4nKSkgLy8gY3JlYXRlIGRpZmZlcmVuY2UgZm9yIHRpcCBhbmQgZmVuY2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHB0aXBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vdCwgYWdhaW4nLCBlcnIubWVzc2FnZVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcGYxXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm90LCBhZ2FpbicsIGVyci5tZXNzYWdlXG5cbiAgICBpdCBAICd1c2UsIGFib3J0IHdpdGggZmVuY2UodHJ1ZSknLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb190cmFjaygpXG4gICAgICByZXMuYWJvcnQobmV3IEVycm9yKCdub3BlJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIGxldCBwdGlwID0gcmVzLnRpcCgpXG4gICAgICBsZXQgcGYwID0gcmVzLmZlbmNlKHRydWUpXG4gICAgICBsZXQgcGYxID0gcmVzLmZlbmNlKHRydWUpXG5cbiAgICAgIGV4cGVjdChwdGlwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChwZjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHBmMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChwZjApLnRvLmVxdWFsKHB0aXApXG4gICAgICBleHBlY3QocGYwKS50by5ub3QuZXF1YWwocGYxKVxuXG4gICAgICByZXMuYWJvcnQobmV3IEVycm9yKCdub3QsIGFnYWluJykpIC8vIGNyZWF0ZSBkaWZmZXJlbmNlIGZvciB0aXAgYW5kIGZlbmNlXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwdGlwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwZjBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBmMVxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vdCwgYWdhaW4nLCBlcnIubWVzc2FnZVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBkZWxheV9yYWNlfSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICBsZXQgZiwgZnpcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuICAgIGFzc2VydC5lcXVhbCBAICd0d28nLCBhd2FpdCBmXG5cbiAgICByZXN1bWUgQCAnZm91cidcbiAgICByZXN1bWUgQCAnZml2ZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICdzaXgnXG4gICAgcmVzdW1lIEAgJ3NldmVuJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3NpeCcsIGF3YWl0IGZcblxuXG4gIGl0IEAgJ25ldmVyIGJsb2NrZWQgb24gZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG5cbiAgaXQgQCAnZXhlcmNpc2UgZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICBsZXQgdiA9ICdhJ1xuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYScpXG5cbiAgICBjb25zdCBwID0gQCE+XG4gICAgICB2ID0gJ2InXG5cbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdiYicpXG5cbiAgICAgIHYgPSAnYydcbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdjYycpXG4gICAgICB2ID0gJ2QnXG4gICAgICByZXR1cm4gMTk0MlxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnZCcpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfZm59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5XG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9mbicsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9mbigpXG5cbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGlzX2ZlbmNlX2NvcmUocmVzWzBdKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSBmZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LCBcbiAgaXNfZmVuY2VfY29yZSxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vYmonLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG4gICAgZXhwZWN0KHJlcy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMucmVzdW1lKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hYm9ydCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXNfZmVuY2VfY29yZSBAIHJlc1xuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2RlZmVyX3doZW4sIGFvX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fd2hlbiBhbmQgYW9fZGVmZXJfd2hlbicsIEA6OlxuXG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgZXhwZWN0KGFvX3doZW4pLnRvLmVxdWFsKGFvX2RlZmVyX3doZW4pXG5cbiAgICBjb25zdCByZXMgPSBhb193aGVuKClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICBleHBlY3QocmVzLmhhcykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZ2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlbGV0ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVmaW5lKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnd2hlbiBtYXAtbGlrZSB3aXRoIGRlZmVycmVkIHByb21pc2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3doZW4oKVxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfc2V0ID0gcmVzLnNldCgnc29tZS1rZXknLCAnc29tZS12YWx1ZScpXG4gICAgZXhwZWN0KHBfc2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KHBfc2V0KS50by5lcXVhbChwX2dldClcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ3NvbWUtdmFsdWUnKVxuXG4gIGl0IEAgJ3doZW4gZGVmZXJlZCBtdWx0aXBsZSBzZXQnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fd2hlbigpXG4gICAgbGV0IHBfZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIGxldCBwX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcblxuICAgIC8vIGV4cGVjdCBmaXJzdCB2YWx1ZVxuICAgIGV4cGVjdChhd2FpdCBwX3NldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIC8vIGV4cGVjdCBmaXJzdCB2YWx1ZVxuICAgIGV4cGVjdChhd2FpdCByZXMuZ2V0KCdzb21lLWtleScpKS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX3RyYWNrX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX3RyYWNrX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3doZW4oKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgIGV4cGVjdChyZXMuaGFzKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVsZXRlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWZpbmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICd3aGVuIG1hcC1saWtlIHdpdGggZmVuY2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3RyYWNrX3doZW4oKVxuXG4gICAgbGV0IHBfZ2V0ID0gcmVzLmdldCgnc29tZS1rZXknKVxuICAgIGV4cGVjdChwX2dldCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9zZXQgPSByZXMuc2V0KCdzb21lLWtleScsICdzb21lLXZhbHVlJylcbiAgICBleHBlY3QocF9zZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgLy8gZXhwZWN0IHNhbWUgdmFsdWVcbiAgICBleHBlY3QocF9zZXQpLnRvLmVxdWFsKHBfZ2V0KVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnc29tZS12YWx1ZScpXG5cblxuICBpdCBAICd3aGVuIHRyYWNrIGNoYW5nZWQnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fdHJhY2tfd2hlbigpXG5cbiAgICBsZXQgcF9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIGxldCBwX2dldF9wcmUgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnYW5vdGhlci12YWx1ZScpXG4gICAgbGV0IHBfZ2V0X3Bvc3QgPSByZXMuZ2V0KCdzb21lLWtleScpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0X3ByZSkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfcG9zdCkudG8uZXF1YWwoJ2Fub3RoZXItdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3doZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgIGV4cGVjdChyZXMuaGFzKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZGVsZXRlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWZpbmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICd3aGVuIG1hcC1saWtlIHdpdGggZmVuY2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuICAgIGxldCBmbl9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KGZuX2dldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgbGV0IHBfZ2V0ID0gZm5fZ2V0KClcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IGZuX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChmbl9zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KGZuX3NldCkudG8uZXF1YWwoZm5fZ2V0KVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnc29tZS12YWx1ZScpXG5cblxuICBpdCBAICd3aGVuIGZlbmNlIHJlc2V0JywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuXG4gICAgbGV0IGZuX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcblxuICAgIGxldCBwX2dldCA9IGZuX2dldCgpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIGxldCBwX2dldF8yID0gZm5fZ2V0KCkgLy8gcmVzZXRcbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfMikudG8uZXF1YWwoJ2Fub3RoZXItdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX291dCwgYW9faXRlciwgYW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsXG4gIGlzX2ZlbmNlX2NvcmUsXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vdXQnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX291dCgpXG4gICAgZXhwZWN0KHJlcy5hb19ib3VuZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5iaW5kX2dhdGVkKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hbGxvd19tYW55KS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdjaGVjayBub3QgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXNzZXJ0LmZhaWwgQCAnc2hvdWxkIGhhdmUgcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgY2F0Y2ggZXJyIDo6XG4gICAgICBpZiAvYW9fZmVuY2Vfb3V0IG5vdCBib3VuZC8udGVzdChlcnIubWVzc2FnZSkgOjpcbiAgICAgICAgLy8gd29ya2VkXG4gICAgICBlbHNlIHRocm93IGVyclxuXG5cbiAgaXQgQCAnY2hlY2sgYWxyZWFkeSBib3VuZCBlcnJvcicsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcblxuICAgIHRyeSA6OlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBjb25zdW1lZDsvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuICBpdCBAICdhbGxvd19tYW55KCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX2ZvcmsoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICBpdCBAICdhb19ib3VuZCgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19ib3VuZCgpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fcnVuKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBsZXQgcCA9IGYuYW9fcnVuKClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgZXhwZWN0KGYud2hlbl9ydW4pLnRvLmVxdWFsKHApXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZmVuY2VfZ2VuLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4nLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9nZW4gQCBhb19mZW5jZV9pbigpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fZm9sZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfc2luaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19mb2xkKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2l0ZXIsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfc2luaywgYW9fZmVuY2VfaXRlciwgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX2JhcmUnLCBmdW5jdGlvbigpIDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2Vfc2luaygpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGlzX2dlbihzb21lX3F1ZXVlLmdfaW4pXG4gICAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuICAgIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuICAgICAgbGV0IHNlY29uZF9xdWV1ZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3F1ZXVlIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc2Vjb25kX3F1ZXVlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICAgIGZpcnN0X3F1ZXVlLmdfaW5cblxuICAgICAgYXdhaXQgZmlyc3RfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2l0ZXIoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2VfaXRlcigpXG5cbiAgICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3BpcGUgPSBhb19mZW5jZV9pdGVyKClcbiAgICAgIGxldCBzZWNvbmRfcGlwZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3BpcGUgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgICAgc2Vjb25kX3BpcGUuZ19pbiA9IGZpcnN0X3BpcGUuZ19pblxuXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc2Vjb25kX3BpcGUsXG4gICAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19wdXNoX3N0cmVhbSwgYXNfaXRlcl9wcm90bywgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX3N0cmVhbScsIGZ1bmN0aW9uKCkgOjpcblxuICBkZXNjcmliZSBAICdhb19wdXNoX3N0cmVhbSgpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9zdHJlYW0gPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgZXhwZWN0KHNvbWVfc3RyZWFtLmdfaW4pLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3N0cmVhbSA9IGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9zdHJlYW0pLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIHNvbWVfc3RyZWFtLnB1c2ggQCAnZmlyc3QnXG4gICAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5kZWVwLmVxdWFsIEA6XG4gICAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG5cbiAgICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgICBsZXQgZmlyc3Rfc3RyZWFtID0gYW9fcHVzaF9zdHJlYW0oKVxuXG4gICAgICBsZXQgc2Vjb25kX3N0cmVhbSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3N0cmVhbSA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNlY29uZF9zdHJlYW0pXG5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMCA6OlxuICAgICAgICBmaXJzdF9zdHJlYW0ucHVzaCh2KVxuXG4gICAgICBmaXJzdF9zdHJlYW0uYWJvcnQoKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyX2ZlbmNlZCwgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fZGVib3VuY2UnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2RlYm91bmNlKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICBleHBlY3QoYW90LndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LndoZW5fcnVuXG5cblxuICBpdCBAICdhb19pdGVyX2ZlbmNlZCB3aXRoIGFvX2ludGVydmFsIGFzIHJhdGUgbGltaXQnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQFxuICAgICAgYW9faXRlcl9mZW5jZWQgQFxuICAgICAgICBbMzAsIDIwLCAxMCwgMTVdXG4gICAgICAgIGFvX2ludGVydmFsKDEwKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGV4cGVjdCh2YWx1ZSkudG8uZXF1YWwoMzApXG5cbiAgICBsZXQgbHN0ID0gW3ZhbHVlXVxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KGxzdCkudG8uZGVlcC5lcXVhbCBAXG4gICAgICBbMzAsIDIwLCAxMCwgMTVdXG5cblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2FuaW1hdGlvbiwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGFuaW1hdGlvbiBmcmFtZXMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9hbmltYXRpb25cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA6OlxuXG4gICAgaXQgQCAnYW9fZG9tX2FuaW1hdGlvbicsIEA6Oj5cbiAgICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9hbmltYXRpb24oKVxuICAgICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodmFsdWUgPj0gMClcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG5cbiAgICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19kb21fYW5pbWF0aW9uKClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fbGlzdGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheSxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgYXJyYXlfZnJvbV9hb19pdGVyXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGV2ZW50cycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2xpc3RlblxuXG4gICAgbGV0IGRlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fbGlzdGVuKClcbiAgICBpc19nZW4gQCBkZS5nX2luXG4gICAgaXNfZm4gQCBkZS53aXRoX2RvbVxuXG5cbiAgaXQgQCAnc2hhcGUgb2Ygd2l0aF9kb20nLCBAOjpcbiAgICBsZXQgbW9jayA9IEB7fVxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihldnQsIGZuLCBvcHQpIDo6XG5cbiAgICBsZXQgZV9jdHggPSBhb19kb21fbGlzdGVuKClcbiAgICAgIC53aXRoX2RvbShtb2NrKVxuXG4gICAgaXNfZm4gQCBlX2N0eC53aXRoX2RvbVxuICAgIGlzX2ZuIEAgZV9jdHgubGlzdGVuXG5cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsIDo6XG5cbiAgICBpdCBAICdtZXNzYWdlIGNoYW5uZWxzJywgQDo6PlxuICAgICAgY29uc3Qge3BvcnQxLCBwb3J0Mn0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKVxuXG4gICAgICBjb25zdCBhb190Z3QgPSBhb19kb21fbGlzdGVuKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFvX3RndClcblxuICAgICAgYW9fdGd0XG4gICAgICAgIC53aXRoX2RvbSBAIHBvcnQyLCB2b2lkIHBvcnQyLnN0YXJ0KClcbiAgICAgICAgLmxpc3RlbiBAICdtZXNzYWdlJywgZXZ0ID0+IEA6IHRlc3RfbmFtZTogZXZ0LmRhdGFcblxuICAgICAgOjohPlxuICAgICAgICBmb3IgbGV0IG0gb2YgWydhJywgJ2InLCAnYyddIDo6XG4gICAgICAgICAgcG9ydDEucG9zdE1lc3NhZ2UgQCBgZnJvbSBtc2cgcG9ydDE6ICR7bX1gXG4gICAgICAgICAgYXdhaXQgZGVsYXkoMSlcblxuICAgICAgICBhb190Z3QuZ19pbi5yZXR1cm4oKVxuICAgICAgICBwb3J0MS5jbG9zZSgpXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGEnXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYidcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIl0sIm5hbWVzIjpb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QUFDLEtBQUssRUFBRSxJQUFJLEVBQUU7RUFDL0IsRUFBRSxJQUFJLENBQUMsR0FBRyxVQUFVLEVBQUUsQ0FBQztFQUN2QixFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsS0FBSztFQUMxQixJQUFJLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDbkIsSUFBSSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNoQixJQUFJLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2YsSUFBSSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDbEI7RUFDQSxTQUFTLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxVQUFVLEVBQUUsRUFBRTtFQUNoRDtFQUNBLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztFQUN4QixFQUFFLElBQUksS0FBSyxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNwRSxFQUFFLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0VBQ3BDLEVBQUUsSUFBSSxLQUFLLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxDQUFDO0VBQy9DO0VBQ0EsRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtBQUMzQztFQUNBLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFF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QUNBLEVBQUUsU0FBUyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7RUFDdEMsSUFBSSxPQUFPLEdBQUcsSUFBSTtFQUNsQixNQUFNLElBQUksQ0FBQyxHQUFHLE1BQU07RUFDcEIsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUM7RUFDbEMsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzNCO0VBQ0EsTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7RUFDckIsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFO0FBQ2pDO0FBQ0E7RUFDQSxTQUFTLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRTtFQUN0QyxFQUFFLElBQUksT0FBTyxDQUFDO0VBQ2QsRUFBRSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRTtFQUNwQixJQUFJLFNBQVMsQ0FBQyxJQUFJO0VBQ2xCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFDO0VBQ0EsRUFBRSxPQUFPO0VBQ1QsSUFBSSxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUk7RUFDekIsSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLEVBQUU7RUFDcEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxNQUFNLEdBQUcsT0FBTyxDQUFDO0FBQ2hDO0VBQ0EsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7RUFDNUIsTUFBTSxJQUFJLFVBQVUsS0FBSyxPQUFPLElBQUksRUFBRTtFQUN0QyxRQUFRLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztFQUMzQyxRQUFRLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFF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
