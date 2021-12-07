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


  const ao_done$1 = Object.freeze({ao_done: true});
  const ao_check_done = err => {
    if (err !== ao_done$1 && err && !err.ao_done) {
      throw err}
    return true};


  const _ag_copy = ({g_in}, ag_out) =>(
    undefined === g_in ? ag_out :(
      ag_out.g_in = g_in
    , ag_out) );

  function ao_when_map(ao_fn_v, db=new Map()) {
    let at = k => {
      let e = db.get(k);
      if (undefined === e) {
        db.set(k, e=ao_fn_v());}
      return e};

    let define = (k, v) => {
      let [r, fn] = at(k);
      fn(v); // e.g. deferred resolve or fence resume()
      return r};

    return {
      has: k => db.has(k)
    , get: k => at(k)[0]
    , set: define, define} }

  function ao_defer_ctx(as_res = (...args) => args) {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , as_res(p, y, n)) }

  const ao_defer_v = /* #__PURE__ */ ao_defer_ctx();

  const ao_defer = /* #__PURE__ */
    ao_defer_ctx((p,y,n) =>
      ({promise: p, resolve: y, reject: n}));


  function ao_track_v(step, reset_v=ao_defer_v) {
    let r, p, x=reset_v();
    let resume = ans => xz(x[1], ans);
    let abort  = err => xz(x[2], err || ao_done);
    return r =[p=x[0], resume, abort]

    function xz(xf, v) {
      let p0 = r[0] = p;
      p = (x = reset_v())[0];
      xf(v);
      if (step) {step(p0, p);} } }


  const ao_track_when = db =>
    ao_when_map(ao_track_v, db);

  const ao_when = db =>
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

  function ao_fence_v(proto) {
    let x, p0, p=0, reset=ao_defer_ctx();

    let fence  = at =>(0===at ? p0 : 0!==p ? p : p=(x=reset())[0]);
    let resume = ans => xz(x[1], ans);
    let abort  = err => xz(x[2], err || ao_done$1);

    p0 = fence(); // initialize x, p, and p0
    return proto
      ?{__proto__: proto, fence, resume, abort}
      :[fence, resume, abort]

    function xz(xf, v) {
      if (0!==p) {
        p0 = p; p = 0;
        xf(v);} } }

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


  const ao_fence_obj = /* #__PURE__ */
    ao_fence_v.bind(null, _ao_fence_core_api_);

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

  const ao_fence_out = /* #__PURE__ */ ao_fence_v.bind(null,{
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
    let f_in = ao_fence_v({}), f_out = ao_fence_v({});
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

  const ao_fence_in = /* #__PURE__ */ ao_fence_v.bind(null,{
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
  , return() {return {value: this.abort(ao_done$1), done: true}}
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
      let f, fz;

      resume('one');
      f = fence();
      resume('two');
      resume('three');

      assert.equal('two', await f);

      fz = fence(0); // non-resetting
      assert.equal('two', await fz);

      resume('four');
      resume('five');
      f = fence();
      resume('six');
      resume('seven');

      assert.equal('six', await f);
      fz = fence(0); // non-resetting
      assert.equal('six', await fz); }) );


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

  describe('core ao_when', (() => {

    it('shape', (() => {
      const res = ao_when();
      expect(res).to.be.an('object');
      expect(res.has).to.be.a('function');
      expect(res.get).to.be.a('function');
      expect(res.set).to.be.a('function');}) );

    it('when map-like with deferred promises', (async () => {
      const res = ao_when();
      let p_get = res.get('some-key');
      expect(p_get).to.be.a('promise');

      let p_set = res.set('some-key', 'some-value');
      expect(p_set).to.be.a('promise');

      // expect same value
      expect(p_set).to.equal(p_get);

      expect(await p_get).to.equal('some-value');}) );

    it('when defered multiple set', (async () => {
      const res = ao_when();
      let p_get = res.get('some-key');
      let p_set = res.set('some-key', 'first-value');
      expect(await p_get).to.equal('first-value');

      res.set('some-key', 'another-value');

      // expect first value
      expect(await p_set).to.equal('first-value');

      // expect first value
      expect(await res.get('some-key')).to.equal('first-value');}) ); }) );

  describe('ao_when and ao_track_when', (() => {

    it('shape', (() => {
      const res = ao_track_when();
      expect(res).to.be.an('object');
      expect(res.has).to.be.a('function');
      expect(res.get).to.be.a('function');
      expect(res.set).to.be.a('function');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvd2hlbl9kZWZlci5qc3kiLCIuLi91bml0L3doZW5fdHJhY2suanN5IiwiLi4vdW5pdC93aGVuX2ZlbmNlLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb3V0LmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC94Zm9ybS5qc3kiLCIuLi91bml0L2ZvbGQuanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L2ZlbmNlX2JhcmUuanN5IiwiLi4vdW5pdC9mZW5jZV9zdHJlYW0uanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2NvcmUoZikgOjpcbiAgaXNfZm4oZi5mZW5jZSlcbiAgaXNfZm4oZi5hb19mb3JrKVxuICBpc19hc3luY19pdGVyYWJsZShmKVxuXG4gIGlzX2ZuKGYuYW9fY2hlY2tfZG9uZSlcbiAgLy8gaXNfZm4oZi5jaGFpbikgLS0gbW92ZWQgdG8gZXhwZXJpbWVudGFsL2NoYWluLm1kXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19mZW5jZV9nZW4oZikgOjpcbiAgaXNfZmVuY2VfY29yZShmKVxuICBpc19mbihmLmFib3J0KVxuICBpc19mbihmLnJlc3VtZSlcblxuICBpc19nZW4oZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IGlzX2FvX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcblxuXG5jb25zdCBhb19kb25lJDEgPSBPYmplY3QuZnJlZXplKHthb19kb25lOiB0cnVlfSk7XG5jb25zdCBhb19jaGVja19kb25lID0gZXJyID0+IHtcbiAgaWYgKGVyciAhPT0gYW9fZG9uZSQxICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5jb25zdCBfYWdfY29weSA9ICh7Z19pbn0sIGFnX291dCkgPT4oXG4gIHVuZGVmaW5lZCA9PT0gZ19pbiA/IGFnX291dCA6KFxuICAgIGFnX291dC5nX2luID0gZ19pblxuICAsIGFnX291dCkgKTtcblxuZnVuY3Rpb24gYW9fd2hlbl9tYXAoYW9fZm5fdiwgZGI9bmV3IE1hcCgpKSB7XG4gIGxldCBhdCA9IGsgPT4ge1xuICAgIGxldCBlID0gZGIuZ2V0KGspO1xuICAgIGlmICh1bmRlZmluZWQgPT09IGUpIHtcbiAgICAgIGRiLnNldChrLCBlPWFvX2ZuX3YoKSk7fVxuICAgIHJldHVybiBlfTtcblxuICBsZXQgZGVmaW5lID0gKGssIHYpID0+IHtcbiAgICBsZXQgW3IsIGZuXSA9IGF0KGspO1xuICAgIGZuKHYpOyAvLyBlLmcuIGRlZmVycmVkIHJlc29sdmUgb3IgZmVuY2UgcmVzdW1lKClcbiAgICByZXR1cm4gcn07XG5cbiAgcmV0dXJuIHtcbiAgICBoYXM6IGsgPT4gZGIuaGFzKGspXG4gICwgZ2V0OiBrID0+IGF0KGspWzBdXG4gICwgc2V0OiBkZWZpbmUsIGRlZmluZX0gfVxuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBhc19yZXMocCwgeSwgbikpIH1cblxuY29uc3QgYW9fZGVmZXJfdiA9IC8qICNfX1BVUkVfXyAqLyBhb19kZWZlcl9jdHgoKTtcblxuY29uc3QgYW9fZGVmZXIgPSAvKiAjX19QVVJFX18gKi9cbiAgYW9fZGVmZXJfY3R4KChwLHksbikgPT5cbiAgICAoe3Byb21pc2U6IHAsIHJlc29sdmU6IHksIHJlamVjdDogbn0pKTtcblxuXG5mdW5jdGlvbiBhb190cmFja192KHN0ZXAsIHJlc2V0X3Y9YW9fZGVmZXJfdikge1xuICBsZXQgciwgcCwgeD1yZXNldF92KCk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4geHooeFsxXSwgYW5zKTtcbiAgbGV0IGFib3J0ICA9IGVyciA9PiB4eih4WzJdLCBlcnIgfHwgYW9fZG9uZSk7XG4gIHJldHVybiByID1bcD14WzBdLCByZXN1bWUsIGFib3J0XVxuXG4gIGZ1bmN0aW9uIHh6KHhmLCB2KSB7XG4gICAgbGV0IHAwID0gclswXSA9IHA7XG4gICAgcCA9ICh4ID0gcmVzZXRfdigpKVswXTtcbiAgICB4Zih2KTtcbiAgICBpZiAoc3RlcCkge3N0ZXAocDAsIHApO30gfSB9XG5cblxuY29uc3QgYW9fdHJhY2tfd2hlbiA9IGRiID0+XG4gIGFvX3doZW5fbWFwKGFvX3RyYWNrX3YsIGRiKTtcblxuY29uc3QgYW9fd2hlbiA9IGRiID0+XG4gIGFvX3doZW5fbWFwKGFvX2RlZmVyX3YsIGRiKTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb19pdGVyX2ZlbmNlZChpdGVyYWJsZSwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgIGF3YWl0IGY7XG4gICAgeWllbGQgdjtcbiAgICBmID0gZl9nYXRlLmZlbmNlKCk7fSB9XG5cblxuY29uc3QgYW9faXRlcl9mZW5jZWQgPSAoLi4uYXJncykgPT5cbiAgX2FnX2NvcHkoYXJnc1swXSwgX2FvX2l0ZXJfZmVuY2VkKC4uLmFyZ3MpKTtcblxuZnVuY3Rpb24gYW9fZmVuY2Vfdihwcm90bykge1xuICBsZXQgeCwgcDAsIHA9MCwgcmVzZXQ9YW9fZGVmZXJfY3R4KCk7XG5cbiAgbGV0IGZlbmNlICA9IGF0ID0+KDA9PT1hdCA/IHAwIDogMCE9PXAgPyBwIDogcD0oeD1yZXNldCgpKVswXSk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4geHooeFsxXSwgYW5zKTtcbiAgbGV0IGFib3J0ICA9IGVyciA9PiB4eih4WzJdLCBlcnIgfHwgYW9fZG9uZSQxKTtcblxuICBwMCA9IGZlbmNlKCk7IC8vIGluaXRpYWxpemUgeCwgcCwgYW5kIHAwXG4gIHJldHVybiBwcm90b1xuICAgID97X19wcm90b19fOiBwcm90bywgZmVuY2UsIHJlc3VtZSwgYWJvcnR9XG4gICAgOltmZW5jZSwgcmVzdW1lLCBhYm9ydF1cblxuICBmdW5jdGlvbiB4eih4Ziwgdikge1xuICAgIGlmICgwIT09cCkge1xuICAgICAgcDAgPSBwOyBwID0gMDtcbiAgICAgIHhmKHYpO30gfSB9XG5cbmNvbnN0IGFvX2ZlbmNlX3doZW4gPSBkYiA9PlxuICBhb193aGVuX21hcChhb19mZW5jZV92LCBkYik7XG5cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcl9mZW5jZShmZW5jZSkge1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgciA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICBpZiAodW5kZWZpbmVkICE9PSByKSB7XG4gICAgICAgIHlpZWxkIHI7fSB9IH1cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH1cblxuXG5cbmNvbnN0IF9hb19mZW5jZV9jb3JlX2FwaV8gPSB7XG4gIGFvX2NoZWNrX2RvbmVcblxuLCAvLyBjb3B5YWJsZSBmZW5jZSBmb3JrIGFwaVxuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmFvX2ZvcmsoKX1cblxuLCBhb19mb3JrKCkge1xuICAgIGxldCBhZyA9IGFvX2l0ZXJfZmVuY2UodGhpcy5mZW5jZSk7XG4gICAgbGV0IHt4ZW1pdH0gPSB0aGlzO1xuICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnKSA6IGFnfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcbiAgcmV0dXJuIGZ9XG5cblxuY29uc3QgYW9fZmVuY2Vfb2JqID0gLyogI19fUFVSRV9fICovXG4gIGFvX2ZlbmNlX3YuYmluZChudWxsLCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcblxuXG5mdW5jdGlvbiBhc19pdGVyX3Byb3RvKHJlc3VtZSwgYWJvcnQsIGRvbmUgPSB0cnVlKSB7XG4gIHJldHVybiB7XG4gICAgbmV4dDogdiA9Pih7dmFsdWU6IHJlc3VtZSh2KSwgZG9uZX0pXG4gICwgcmV0dXJuOiAoKSA9Pih7dmFsdWU6IGFib3J0KGFvX2RvbmUkMSksIGRvbmV9KVxuICAsIHRocm93OiAoZXJyKSA9Pih7dmFsdWU6IGFib3J0KGVyciksIGRvbmV9KSB9IH1cblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IC8qICNfX1BVUkVfXyAqLyBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG4sIF9hb19tYW55KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOyBjb25zaWRlciAuYW9fZm9yaygpIG9yIC5hbGxvd19tYW55KCknKX1cblxuLCBhbGxvd19tYW55KCkge1xuICAgIGxldCB7YW9fZm9yaywgYW9fYm91bmQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgaWYgKF9hb19tYW55ID09PSBhb19ib3VuZCkge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IGFvX2Zvcms7fVxuICAgIHRoaXMuX2FvX21hbnkgPSBhb19mb3JrO1xuICAgIHRoaXMuYWxsb3dfbWFueSA9ICgpID0+IHRoaXM7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMuYW9fYm91bmQoKSk7IH1cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgbGV0IHt4ZW1pdCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBfYW9fbWFueTtcbiAgICAgIHJldHVybiB4ZW1pdFxuICAgICAgICA/IF9hZ19jb3B5KGFnX291dCwgeGVtaXQoYWdfb3V0KSlcbiAgICAgICAgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmJpbmRfZ2F0ZWQoZl9nYXRlKS5hb19ib3VuZCgpfVxuXG4sIF9hb19nYXRlZChmX2dhdGUpIHtyZXR1cm4gYW9nX2dhdGVkKHRoaXMsIGZfZ2F0ZSl9IH0gKTtcblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19nYXRlZChmX291dCwgZl9nYXRlKSB7XG4gIHRyeSB7XG4gICAgZl9vdXQucmVzdW1lKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICB5aWVsZCB2O1xuICAgICAgZl9vdXQucmVzdW1lKHYpO30gfVxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9vdXQuYWJvcnQoKTtcbiAgICBpZiAoZl9nYXRlLmFib3J0KSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTt9IH0gfVxuXG5jb25zdCBhb19mZWVkZXIgPSAoe2dfaW59KSA9PiB2ID0+IGdfaW4ubmV4dCh2KTtcbmNvbnN0IGFvX2ZlZWRlcl92ID0gKHtnX2lufSkgPT4gKC4uLmFyZ3MpID0+IGdfaW4ubmV4dChhcmdzKTtcblxuXG5mdW5jdGlvbiBhb2dfZmVuY2VfeGYoeGluaXQsIC4uLmFyZ3MpIHtcbiAgbGV0IGZfaW4gPSBhb19mZW5jZV92KHt9KSwgZl9vdXQgPSBhb19mZW5jZV92KHt9KTtcbiAgbGV0IGdfaW4gPSB4aW5pdChmX2luLCBmX291dCwgLi4uYXJncyk7XG4gIGdfaW4ubmV4dCgpO1xuXG4gIGxldCByZXMgPSBhb2dfZ2F0ZWQoZl9vdXQsIGZfaW4pO1xuICByZXMuZmVuY2UgPSBmX291dC5mZW5jZTtcbiAgcmVzLmdfaW4gPSBnX2luO1xuICByZXR1cm4gcmVzfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9pdGVyKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGFvZ19mZW5jZV94Zihhb2dfaXRlciwgLi4uYXJncyl9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3NpbmsoLi4uYXJncykge1xuICByZXR1cm4gYW9nX2ZlbmNlX3hmKGFvZ19zaW5rLCAuLi5hcmdzKX1cblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0gKHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgZl9pbi5yZXN1bWUodGlwKTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX3NpbmsoZl9pbiwgZl9nYXRlLCB4Zikge1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICAge1xuICAgICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgICAgdGlwID0gKGF3YWl0IHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgICBmX2luLnJlc3VtZSh0aXApO31cblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZl9nYXRlKSB7XG4gICAgICAgIGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO30gfSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuY29uc3QgYW9feGZvcm0gPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb194Zm9ybShuc19nZW4pO1xuY29uc3QgYW9fZm9sZCA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX2ZvbGQobnNfZ2VuKTtcbmNvbnN0IGFvX3F1ZXVlID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUobnNfZ2VuKTtcblxuY29uc3QgYW9fZmVuY2VfaW4gPSAvKiAjX19QVVJFX18gKi8gYW9fZmVuY2Vfdi5iaW5kKG51bGwse1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17fSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4ZW1pdCwgeGluaXQsIHhyZWN2fSA9XG4gICAgICBpc19hb19mbihuc19nZW4pXG4gICAgICAgID8gbnNfZ2VuKHRoaXMsIGZfb3V0KVxuICAgICAgICA6IG5zX2dlbjtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhlbWl0KSB7XG4gICAgICBmX291dC54ZW1pdCA9IHhlbWl0O31cblxuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LFxuICAgICAgeHJlY3YgPyBfeGZfZ2VuLmNyZWF0ZSh4cmVjdikgOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGdfaW4gPSBmX291dC5nX2luID0gcmVzLmdfaW4gfHwgcmVzO1xuICAgIHJldHVybiByZXMgIT09IGdfaW5cbiAgICAgID8gcmVzIC8vIHJlcyBpcyBhbiBvdXRwdXQgZ2VuZXJhdG9yXG4gICAgICA6KC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgICAgICBnX2luLm5leHQoKSxcbiAgICAgICAgICBmX291dC5iaW5kX2dhdGVkKHRoaXMpKSB9XG5cbiwgLy8gRVMyMDE1IGdlbmVyYXRvciBhcGlcbiAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuLCByZXR1cm4oKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChhb19kb25lJDEpLCBkb25lOiB0cnVlfX1cbiwgdGhyb3coZXJyKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChlcnIpLCBkb25lOiB0cnVlfX0gfSApO1xuXG5cbmNvbnN0IF94Zl9nZW4gPSB7XG4gIGNyZWF0ZSh4Zikge1xuICAgIGxldCBzZWxmID0ge19fcHJvdG9fXzogdGhpc307XG4gICAgc2VsZi54ZyA9IHhmKHNlbGYueGZfaW52KCkpO1xuICAgIHJldHVybiBzZWxmfVxuXG4sICp4Zl9pbnYoKSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB0aGlzLl90aXA7XG4gICAgICBpZiAodGhpcyA9PT0gdGlwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5kZXJmbG93Jyl9XG4gICAgICBlbHNlIHRoaXMuX3RpcCA9IHRoaXM7XG5cbiAgICAgIHlpZWxkIHRpcDt9IH1cblxuLCBuZXh0KHYpIHtcbiAgICB0aGlzLl90aXAgPSB2O1xuICAgIHJldHVybiB0aGlzLnhnLm5leHQodil9XG5cbiwgcmV0dXJuKCkge3RoaXMueGcucmV0dXJuKCk7fVxuLCB0aHJvdygpIHt0aGlzLnhnLnRocm93KCk7fSB9O1xuXG5mdW5jdGlvbiBhb19wdXNoX3N0cmVhbShhc192ZWMpIHtcbiAgbGV0IHE9W10sIFtmZW5jZSwgcmVzdW1lLCBhYm9ydF0gPSBhb19mZW5jZV92KCk7XG4gIGxldCBzdHJlYW0gPSBhb19zdHJlYW1fZmVuY2UoZmVuY2UpO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHN0cmVhbSx7XG4gICAgc3RyZWFtXG4gICwgYWJvcnRcbiAgLCBwdXNoKC4uLiBhcmdzKSB7XG4gICAgICBpZiAodHJ1ZSA9PT0gYXNfdmVjKSB7XG4gICAgICAgIHEucHVzaChhcmdzKTt9XG4gICAgICBlbHNlIHEucHVzaCguLi4gYXJncyk7XG5cbiAgICAgIHJlc3VtZShxKTtcbiAgICAgIHJldHVybiBxLmxlbmd0aH0gfSApIH1cblxuXG5mdW5jdGlvbiBhb19zdHJlYW1fZmVuY2UoZmVuY2UpIHtcbiAgbGV0IFt3aGVuX2RvbmUsIHJlc19kb25lLCByZWpfZG9uZV0gPSBhb19kZWZlcl92KCk7XG4gIGxldCByZXMgPSBfYW9fc3RyZWFtX2ZlbmNlKGZlbmNlLCByZXNfZG9uZSwgcmVqX2RvbmUpO1xuICByZXMud2hlbl9kb25lID0gd2hlbl9kb25lO1xuICByZXR1cm4gcmVzfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3N0cmVhbV9mZW5jZShmZW5jZSwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gIHRyeSB7XG4gICAgbGV0IHBfcmVhZHkgPSBmZW5jZSgpO1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgYmF0Y2ggPSBhd2FpdCBwX3JlYWR5O1xuICAgICAgYmF0Y2ggPSBiYXRjaC5zcGxpY2UoMCwgYmF0Y2gubGVuZ3RoKTtcblxuICAgICAgcF9yZWFkeSA9IGZlbmNlKCk7XG4gICAgICB5aWVsZCAqIGJhdGNoO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBpZiAoIWVyciB8fCBlcnIuYW9fZG9uZSkge1xuICAgICAgcmVzb2x2ZSh0cnVlKTt9XG4gICAgZWxzZSByZWplY3QoZXJyKTt9IH1cblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBhb19pdGVyYWJsZSkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLndoZW5fcnVuID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgICAgcCA9IF9mZW5jZSgpO1xuICAgICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCB2KTt9XG5cbiAgICAgIGF3YWl0IHA7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhhb19pdGVyYWJsZSkge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXN1bWUpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBfZXZ0X2luaXQgPSBQcm9taXNlLnJlc29sdmUoe3R5cGU6J2luaXQnfSk7XG5mdW5jdGlvbiBhb19kb21fbGlzdGVuKHNlbGY9YW9fcXVldWUoKSkge1xuICByZXR1cm4gX2JpbmQuc2VsZiA9IHNlbGYgPXtcbiAgICBfX3Byb3RvX186IHNlbGZcbiAgLCB3aXRoX2RvbShkb20sIGZuKSB7XG4gICAgICByZXR1cm4gZG9tLmFkZEV2ZW50TGlzdGVuZXJcbiAgICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSl9IH1cblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgc2VsZi5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYWdfY29weSwgX2FvX2ZlbmNlX2NvcmVfYXBpXywgX2FvX2l0ZXJfZmVuY2VkLCBfYW9fcnVuLCBfYW9fdGFwLCBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXIsIGFvX2RlZmVyX2N0eCwgYW9fZGVmZXJfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZG9uZSQxIGFzIGFvX2RvbmUsIGFvX2RyaXZlLCBhb19mZWVkZXIsIGFvX2ZlZWRlcl92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfaW4sIGFvX2ZlbmNlX2l0ZXIsIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2Vfb3V0LCBhb19mZW5jZV9zaW5rLCBhb19mZW5jZV92LCBhb19mZW5jZV93aGVuLCBhb19mb2xkLCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9faXRlcl9mZW5jZSwgYW9faXRlcl9mZW5jZWQsIGFvX3B1c2hfc3RyZWFtLCBhb19xdWV1ZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb19zdHJlYW1fZmVuY2UsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGFvX3RyYWNrX3YsIGFvX3RyYWNrX3doZW4sIGFvX3doZW4sIGFvX3hmb3JtLCBhb2dfZmVuY2VfeGYsIGFvZ19nYXRlZCwgYW9nX2l0ZXIsIGFvZ19zaW5rLCBhc19pdGVyX3Byb3RvLCBpc19hb19mbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImltcG9ydCB7YXNzZXJ0LCBpc19mbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5pbXBvcnQge2FvX2RlZmVyLCBhb19kZWZlcl92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19mZW5jZV92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9pbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7aXRlciwgc3RlcF9pdGVyLCBhb19pdGVyLCBhb19zdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmRlc2NyaWJlIEAgJ3Ntb2tlJywgQDo6XG4gIGl0IEAgJ2RlZmVyJywgQDo6XG4gICAgaXNfZm4gQCBhb19kZWZlclxuICAgIGlzX2ZuIEAgYW9fZGVmZXJfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG4gICAgaXNfZm4gQCBhb19mZW5jZV9pblxuXG4gIGl0IEAgJ2RyaXZlJywgQDo6XG4gICAgaXNfZm4gQCBpdGVyXG4gICAgaXNfZm4gQCBzdGVwX2l0ZXJcbiAgICBpc19mbiBAIGFvX2l0ZXJcbiAgICBpc19mbiBAIGFvX3N0ZXBfaXRlclxuICAgIFxuICAgIGlzX2ZuIEAgYW9fcnVuXG4gICAgaXNfZm4gQCBhb19kcml2ZVxuXG4gIGl0IEAgJ3NwbGl0JywgQDo6XG4gICAgaXNfZm4gQCBhb19zcGxpdFxuICAgIGlzX2ZuIEAgYW9fdGFwXG5cbiIsImltcG9ydCB7YW9fZGVmZXIsIGFvX2RlZmVyX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVyJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcl92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVyX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVyX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG5cblxuICBkZXNjcmliZSBAICdhb19kZWZlciBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1bihnKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3RcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBnX3RndC5uZXh0KCdmaW5hbCcpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgICdzZWNvbmQnXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG4gICAgICAnZmluYWwnXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KGxzdCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4gIGl0IEAgJ2FvX2RyaXZlIGZ1bmN0aW9uJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdlbl90ZXN0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgIDE5NDJcbiAgICAgIDIwNDJcbiAgICAgIDIxNDJcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QoKSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiIsImltcG9ydCB7aXRlciwgYW9faXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3RlcF9pdGVyLCBzdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZ2VuXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZSBpdGVycycsIEA6OlxuXG4gIGl0IEAgJ25vcm1hbCBpdGVyJywgQDo6XG4gICAgbGV0IGcgPSBpc19nZW4gQCBpdGVyIEAjIDEwLCAyMCwgMzBcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBnLm5leHQoKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlcicsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX2l0ZXIgQCMgMTAsIDIwLCAzMFxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGF3YWl0IHBcblxuXG4gIGl0IEAgJ25vcm1hbCBzdGVwX2l0ZXInLCBAOjpcbiAgICBsZXQgeiA9IEFycmF5LmZyb20gQFxuICAgICAgemlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG4gICAgZnVuY3Rpb24gKiB6aXAoYSwgYikgOjpcbiAgICAgIGIgPSBzdGVwX2l0ZXIoYilcbiAgICAgIGZvciBsZXQgYXYgb2YgaXRlcihhKSA6OlxuICAgICAgICBmb3IgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG5cbiAgaXQgQCAnYXN5bmMgYW9fc3RlcF9pdGVyJywgQDo6PlxuICAgIGxldCB6ID0gYXdhaXQgYXJyYXlfZnJvbV9hb19pdGVyIEBcbiAgICAgIGFvX3ppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gKiBhb196aXAoYSwgYikgOjpcbiAgICAgIGIgPSBhb19zdGVwX2l0ZXIoYilcbiAgICAgIGZvciBhd2FpdCBsZXQgYXYgb2YgYW9faXRlcihhKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG4iLCJpbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBzcGxpdCcsIEA6OlxuXG4gIGl0IEAgJ2FvX3NwbGl0IHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjA0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMTQyKVxuXG4gICAgICBhd2FpdCBncy53aGVuX3J1blxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cblxuICBpdCBAICdhb190YXAgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBbZl9vdXQsIGFnX3RhcF0gPSBhb190YXAoZylcbiAgICAgIGlzX2FzeW5jX2l0ZXJhYmxlIEAgZl9vdXRcbiAgICAgIGlzX2dlbiBAIGFnX3RhcFxuXG4gICAgICBleHBlY3QoZl9vdXQuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBmX291dC5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0KVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYWdfdGFwKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YXNzZXJ0LCBleHBlY3QsIGRlbGF5X3JhY2V9IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV92IHR1cGxlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3YoKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdvbmx5IGZpcnN0IGFmdGVyJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuICAgIGxldCBmLCBmelxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3R3bycsIGF3YWl0IGZcblxuICAgIGZ6ID0gZmVuY2UoMCkgLy8gbm9uLXJlc2V0dGluZ1xuICAgIGFzc2VydC5lcXVhbCBAICd0d28nLCBhd2FpdCBmelxuXG4gICAgcmVzdW1lIEAgJ2ZvdXInXG4gICAgcmVzdW1lIEAgJ2ZpdmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAnc2l4J1xuICAgIHJlc3VtZSBAICdzZXZlbidcblxuICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG4gICAgZnogPSBmZW5jZSgwKSAvLyBub24tcmVzZXR0aW5nXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3NpeCcsIGF3YWl0IGZ6XG5cblxuICBpdCBAICduZXZlciBibG9ja2VkIG9uIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuXG4gIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgbGV0IHYgPSAnYSdcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgY29uc3QgcCA9IEAhPlxuICAgICAgdiA9ICdiJ1xuXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnYmInKVxuXG4gICAgICB2ID0gJ2MnXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnY2MnKVxuICAgICAgdiA9ICdkJ1xuICAgICAgcmV0dXJuIDE5NDJcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2QnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2ZufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsIFxuICBpc19mZW5jZV9jb3JlLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfZm4nLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpc19mZW5jZV9jb3JlKHJlc1swXSlcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZS5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb2JqJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCByZXMgPSBhb19mZW5jZV9vYmooKVxuICAgIGV4cGVjdChyZXMuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnJlc3VtZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYWJvcnQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGlzX2ZlbmNlX2NvcmUgQCByZXNcblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb193aGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX3doZW4nLCBAOjpcblxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX3doZW4oKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgIGV4cGVjdChyZXMuaGFzKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5nZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLnNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3doZW4gbWFwLWxpa2Ugd2l0aCBkZWZlcnJlZCBwcm9taXNlcycsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb193aGVuKClcbiAgICBsZXQgcF9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KHBfZ2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChwX3NldCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAvLyBleHBlY3Qgc2FtZSB2YWx1ZVxuICAgIGV4cGVjdChwX3NldCkudG8uZXF1YWwocF9nZXQpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdzb21lLXZhbHVlJylcblxuICBpdCBAICd3aGVuIGRlZmVyZWQgbXVsdGlwbGUgc2V0JywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX3doZW4oKVxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICBsZXQgcF9zZXQgPSByZXMuc2V0KCdzb21lLWtleScsICdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnYW5vdGhlci12YWx1ZScpXG5cbiAgICAvLyBleHBlY3QgZmlyc3QgdmFsdWVcbiAgICBleHBlY3QoYXdhaXQgcF9zZXQpLnRvLmVxdWFsKCdmaXJzdC12YWx1ZScpXG5cbiAgICAvLyBleHBlY3QgZmlyc3QgdmFsdWVcbiAgICBleHBlY3QoYXdhaXQgcmVzLmdldCgnc29tZS1rZXknKSkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuIiwiaW1wb3J0IHthb190cmFja193aGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb193aGVuIGFuZCBhb190cmFja193aGVuJywgQDo6XG5cbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb190cmFja193aGVuKClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICBleHBlY3QocmVzLmhhcykudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuZ2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmRlZmluZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3doZW4gbWFwLWxpa2Ugd2l0aCBmZW5jZXMnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fdHJhY2tfd2hlbigpXG5cbiAgICBsZXQgcF9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KHBfZ2V0KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChwX3NldCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAvLyBleHBlY3Qgc2FtZSB2YWx1ZVxuICAgIGV4cGVjdChwX3NldCkudG8uZXF1YWwocF9nZXQpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9nZXQpLnRvLmVxdWFsKCdzb21lLXZhbHVlJylcblxuXG4gIGl0IEAgJ3doZW4gdHJhY2sgY2hhbmdlZCcsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb190cmFja193aGVuKClcblxuICAgIGxldCBwX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICByZXMuc2V0KCdzb21lLWtleScsICdmaXJzdC12YWx1ZScpXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuXG4gICAgbGV0IHBfZ2V0X3ByZSA9IHJlcy5nZXQoJ3NvbWUta2V5JylcbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcbiAgICBsZXQgcF9nZXRfcG9zdCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfcHJlKS50by5lcXVhbCgnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldF9wb3N0KS50by5lcXVhbCgnYW5vdGhlci12YWx1ZScpXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfd2hlbn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfd2hlbicsIEA6OlxuXG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfd2hlbigpXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgZXhwZWN0KHJlcy5oYXMpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmdldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuc2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5kZWZpbmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICd3aGVuIG1hcC1saWtlIHdpdGggZmVuY2VzJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuICAgIGxldCBmbl9nZXQgPSByZXMuZ2V0KCdzb21lLWtleScpXG4gICAgZXhwZWN0KGZuX2dldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgbGV0IHBfZ2V0ID0gZm5fZ2V0KClcbiAgICBleHBlY3QocF9nZXQpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IGZuX3NldCA9IHJlcy5zZXQoJ3NvbWUta2V5JywgJ3NvbWUtdmFsdWUnKVxuICAgIGV4cGVjdChmbl9zZXQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIC8vIGV4cGVjdCBzYW1lIHZhbHVlXG4gICAgZXhwZWN0KGZuX3NldCkudG8uZXF1YWwoZm5fZ2V0KVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfZ2V0KS50by5lcXVhbCgnc29tZS12YWx1ZScpXG5cblxuICBpdCBAICd3aGVuIGZlbmNlIHJlc2V0JywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3doZW4oKVxuXG4gICAgbGV0IGZuX2dldCA9IHJlcy5nZXQoJ3NvbWUta2V5JylcblxuICAgIGxldCBwX2dldCA9IGZuX2dldCgpXG4gICAgcmVzLnNldCgnc29tZS1rZXknLCAnZmlyc3QtdmFsdWUnKVxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcblxuICAgIGxldCBwX2dldF8yID0gZm5fZ2V0KCkgLy8gcmVzZXRcbiAgICByZXMuc2V0KCdzb21lLWtleScsICdhbm90aGVyLXZhbHVlJylcblxuICAgIGV4cGVjdChhd2FpdCBwX2dldCkudG8uZXF1YWwoJ2ZpcnN0LXZhbHVlJylcbiAgICBleHBlY3QoYXdhaXQgcF9nZXRfMikudG8uZXF1YWwoJ2Fub3RoZXItdmFsdWUnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX291dCwgYW9faXRlciwgYW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsXG4gIGlzX2ZlbmNlX2NvcmUsXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vdXQnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX291dCgpXG4gICAgZXhwZWN0KHJlcy5hb19ib3VuZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5iaW5kX2dhdGVkKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hbGxvd19tYW55KS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdjaGVjayBub3QgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXNzZXJ0LmZhaWwgQCAnc2hvdWxkIGhhdmUgcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgY2F0Y2ggZXJyIDo6XG4gICAgICBpZiAvYW9fZmVuY2Vfb3V0IG5vdCBib3VuZC8udGVzdChlcnIubWVzc2FnZSkgOjpcbiAgICAgICAgLy8gd29ya2VkXG4gICAgICBlbHNlIHRocm93IGVyclxuXG5cbiAgaXQgQCAnY2hlY2sgYWxyZWFkeSBib3VuZCBlcnJvcicsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcblxuICAgIHRyeSA6OlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBjb25zdW1lZDsvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuICBpdCBAICdhbGxvd19tYW55KCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX2ZvcmsoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICBpdCBAICdhb19ib3VuZCgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19ib3VuZCgpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fcnVuKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBsZXQgcCA9IGYuYW9fcnVuKClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgZXhwZWN0KGYud2hlbl9ydW4pLnRvLmVxdWFsKHApXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZmVuY2VfZ2VuLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4nLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9nZW4gQCBhb19mZW5jZV9pbigpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fZm9sZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfc2luaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19mb2xkKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2l0ZXIsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfc2luaywgYW9fZmVuY2VfaXRlciwgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX2JhcmUnLCBmdW5jdGlvbigpIDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2Vfc2luaygpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGlzX2dlbihzb21lX3F1ZXVlLmdfaW4pXG4gICAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuICAgIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuICAgICAgbGV0IHNlY29uZF9xdWV1ZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3F1ZXVlIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc2Vjb25kX3F1ZXVlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICAgIGZpcnN0X3F1ZXVlLmdfaW5cblxuICAgICAgYXdhaXQgZmlyc3RfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2l0ZXIoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2VfaXRlcigpXG5cbiAgICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3BpcGUgPSBhb19mZW5jZV9pdGVyKClcbiAgICAgIGxldCBzZWNvbmRfcGlwZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3BpcGUgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgICAgc2Vjb25kX3BpcGUuZ19pbiA9IGZpcnN0X3BpcGUuZ19pblxuXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc2Vjb25kX3BpcGUsXG4gICAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19wdXNoX3N0cmVhbSwgYXNfaXRlcl9wcm90bywgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX3N0cmVhbScsIGZ1bmN0aW9uKCkgOjpcblxuICBkZXNjcmliZSBAICdhb19wdXNoX3N0cmVhbSgpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9zdHJlYW0gPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgZXhwZWN0KHNvbWVfc3RyZWFtLmdfaW4pLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3N0cmVhbSA9IGFvX3B1c2hfc3RyZWFtKClcblxuICAgICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9zdHJlYW0pLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIHNvbWVfc3RyZWFtLnB1c2ggQCAnZmlyc3QnXG4gICAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5kZWVwLmVxdWFsIEA6XG4gICAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG5cbiAgICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgICBsZXQgZmlyc3Rfc3RyZWFtID0gYW9fcHVzaF9zdHJlYW0oKVxuXG4gICAgICBsZXQgc2Vjb25kX3N0cmVhbSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3N0cmVhbSA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNlY29uZF9zdHJlYW0pXG5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMCA6OlxuICAgICAgICBmaXJzdF9zdHJlYW0ucHVzaCh2KVxuXG4gICAgICBmaXJzdF9zdHJlYW0uYWJvcnQoKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyX2ZlbmNlZCwgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fZGVib3VuY2UnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2RlYm91bmNlKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICBleHBlY3QoYW90LndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LndoZW5fcnVuXG5cblxuICBpdCBAICdhb19pdGVyX2ZlbmNlZCB3aXRoIGFvX2ludGVydmFsIGFzIHJhdGUgbGltaXQnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQFxuICAgICAgYW9faXRlcl9mZW5jZWQgQFxuICAgICAgICBbMzAsIDIwLCAxMCwgMTVdXG4gICAgICAgIGFvX2ludGVydmFsKDEwKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGV4cGVjdCh2YWx1ZSkudG8uZXF1YWwoMzApXG5cbiAgICBsZXQgbHN0ID0gW3ZhbHVlXVxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KGxzdCkudG8uZGVlcC5lcXVhbCBAXG4gICAgICBbMzAsIDIwLCAxMCwgMTVdXG5cblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2FuaW1hdGlvbiwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGFuaW1hdGlvbiBmcmFtZXMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9hbmltYXRpb25cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA6OlxuXG4gICAgaXQgQCAnYW9fZG9tX2FuaW1hdGlvbicsIEA6Oj5cbiAgICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9hbmltYXRpb24oKVxuICAgICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodmFsdWUgPj0gMClcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG5cbiAgICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19kb21fYW5pbWF0aW9uKClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fbGlzdGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheSxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgYXJyYXlfZnJvbV9hb19pdGVyXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGV2ZW50cycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2xpc3RlblxuXG4gICAgbGV0IGRlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fbGlzdGVuKClcbiAgICBpc19nZW4gQCBkZS5nX2luXG4gICAgaXNfZm4gQCBkZS53aXRoX2RvbVxuXG5cbiAgaXQgQCAnc2hhcGUgb2Ygd2l0aF9kb20nLCBAOjpcbiAgICBsZXQgbW9jayA9IEB7fVxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihldnQsIGZuLCBvcHQpIDo6XG5cbiAgICBsZXQgZV9jdHggPSBhb19kb21fbGlzdGVuKClcbiAgICAgIC53aXRoX2RvbShtb2NrKVxuXG4gICAgaXNfZm4gQCBlX2N0eC53aXRoX2RvbVxuICAgIGlzX2ZuIEAgZV9jdHgubGlzdGVuXG5cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsIDo6XG5cbiAgICBpdCBAICdtZXNzYWdlIGNoYW5uZWxzJywgQDo6PlxuICAgICAgY29uc3Qge3BvcnQxLCBwb3J0Mn0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKVxuXG4gICAgICBjb25zdCBhb190Z3QgPSBhb19kb21fbGlzdGVuKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFvX3RndClcblxuICAgICAgYW9fdGd0XG4gICAgICAgIC53aXRoX2RvbSBAIHBvcnQyLCB2b2lkIHBvcnQyLnN0YXJ0KClcbiAgICAgICAgLmxpc3RlbiBAICdtZXNzYWdlJywgZXZ0ID0+IEA6IHRlc3RfbmFtZTogZXZ0LmRhdGFcblxuICAgICAgOjohPlxuICAgICAgICBmb3IgbGV0IG0gb2YgWydhJywgJ2InLCAnYyddIDo6XG4gICAgICAgICAgcG9ydDEucG9zdE1lc3NhZ2UgQCBgZnJvbSBtc2cgcG9ydDE6ICR7bX1gXG4gICAgICAgICAgYXdhaXQgZGVsYXkoMSlcblxuICAgICAgICBhb190Z3QuZ19pbi5yZXR1cm4oKVxuICAgICAgICBwb3J0MS5jbG9zZSgpXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGEnXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYidcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztFQUFBLG1DQUFtQyxNQUFNOzs7SUFJdkMsWUFBYTtNQUNYLFdBQVksT0FBUTs7O0lBR3RCLGNBQWU7OztJQUdmO2VBQ1M7TUFDUDtNQUNBOzs7SUFHRixtQkFBbUIsVUFBVTtJQUM3Qjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lB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Q0FBQyxDQUFDO0VBQ3JCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzQztBQUNBO0VBQ0EsU0FBUyxVQUFVLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEVBQUU7RUFDOUMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0VBQ3hCLEVBQUUsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDcEMsRUFBRSxJQUFJLEtBQUssSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLElBQUksT0FBTyxDQUFDLENBQUM7RUFDL0MsRUFBRSxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQztBQUNuQztFQUNBLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtFQUNyQixJQUFJLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDM0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDVixJQUFJLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNoQztBQUNBO0VBQ0EsTUFBTSxhQUFhLEdBQUcsRUFBRTtFQUN4QixFQUFFLFdBQVcsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDOUI7RUFDQSxNQUFNLE9BQU8sR0FBRyxFQUFFO0VB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
