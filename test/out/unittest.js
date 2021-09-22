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

  function ao_defer_ctx(as_res = (...args) => args) {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , as_res(p, y, n)) }

  const ao_defer_v = /* #__PURE__ */ ao_defer_ctx();

  const ao_defer = /* #__PURE__ */
    ao_defer_ctx((p,y,n) =>
      ({promise: p, resolve: y, reject: n}));

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
    let reset = ao_defer_ctx(), x=reset(), p=0;

    let fence  = () =>(0 !== p ? p : p=(x=reset())[0]);
    let resume = ans => {p=0; x[1](ans);};
    let abort  = err => {p=0; x[2](err);};

    return proto
      ?{__proto__: proto, fence, resume, abort}
      :[fence, resume, abort] }



  const _ao_fence_core_api_ = {
    ao_check_done

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
      is_fence_core(ao_fence_obj()); }) );

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

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb3V0LmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC94Zm9ybS5qc3kiLCIuLi91bml0L2ZvbGQuanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L2ZlbmNlX2JhcmUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2NvcmUoZikgOjpcbiAgaXNfZm4oZi5mZW5jZSlcbiAgaXNfZm4oZi5hb19mb3JrKVxuICBpc19hc3luY19pdGVyYWJsZShmKVxuXG4gIGlzX2ZuKGYuYW9fY2hlY2tfZG9uZSlcbiAgLy8gaXNfZm4oZi5jaGFpbikgLS0gbW92ZWQgdG8gZXhwZXJpbWVudGFsL2NoYWluLm1kXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19mZW5jZV9nZW4oZikgOjpcbiAgaXNfZmVuY2VfY29yZShmKVxuICBpc19mbihmLmFib3J0KVxuICBpc19mbihmLnJlc3VtZSlcblxuICBpc19nZW4oZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IGlzX2FvX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcblxuXG5jb25zdCBhb19kb25lID0gT2JqZWN0LmZyZWV6ZSh7YW9fZG9uZTogdHJ1ZX0pO1xuY29uc3QgYW9fY2hlY2tfZG9uZSA9IGVyciA9PiB7XG4gIGlmIChlcnIgIT09IGFvX2RvbmUgJiYgZXJyICYmICFlcnIuYW9fZG9uZSkge1xuICAgIHRocm93IGVycn1cbiAgcmV0dXJuIHRydWV9O1xuXG5cbmNvbnN0IF9hZ19jb3B5ID0gKHtnX2lufSwgYWdfb3V0KSA9PihcbiAgdW5kZWZpbmVkID09PSBnX2luID8gYWdfb3V0IDooXG4gICAgYWdfb3V0LmdfaW4gPSBnX2luXG4gICwgYWdfb3V0KSApO1xuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBhc19yZXMocCwgeSwgbikpIH1cblxuY29uc3QgYW9fZGVmZXJfdiA9IC8qICNfX1BVUkVfXyAqLyBhb19kZWZlcl9jdHgoKTtcblxuY29uc3QgYW9fZGVmZXIgPSAvKiAjX19QVVJFX18gKi9cbiAgYW9fZGVmZXJfY3R4KChwLHksbikgPT5cbiAgICAoe3Byb21pc2U6IHAsIHJlc29sdmU6IHksIHJlamVjdDogbn0pKTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb19pdGVyX2ZlbmNlZChpdGVyYWJsZSwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgIGF3YWl0IGY7XG4gICAgeWllbGQgdjtcbiAgICBmID0gZl9nYXRlLmZlbmNlKCk7fSB9XG5cblxuY29uc3QgYW9faXRlcl9mZW5jZWQgPSAoLi4uYXJncykgPT5cbiAgX2FnX2NvcHkoYXJnc1swXSwgX2FvX2l0ZXJfZmVuY2VkKC4uLmFyZ3MpKTtcblxuZnVuY3Rpb24gYW9fZmVuY2Vfdihwcm90bykge1xuICBsZXQgcmVzZXQgPSBhb19kZWZlcl9jdHgoKSwgeD1yZXNldCgpLCBwPTA7XG5cbiAgbGV0IGZlbmNlICA9ICgpID0+KDAgIT09IHAgPyBwIDogcD0oeD1yZXNldCgpKVswXSk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4ge3A9MDsgeFsxXShhbnMpO307XG4gIGxldCBhYm9ydCAgPSBlcnIgPT4ge3A9MDsgeFsyXShlcnIpO307XG5cbiAgcmV0dXJuIHByb3RvXG4gICAgP3tfX3Byb3RvX186IHByb3RvLCBmZW5jZSwgcmVzdW1lLCBhYm9ydH1cbiAgICA6W2ZlbmNlLCByZXN1bWUsIGFib3J0XSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID0ge1xuICBhb19jaGVja19kb25lXG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSB0aGlzLl9hb19mb3JrKCk7XG4gICAgbGV0IHt4ZW1pdH0gPSB0aGlzO1xuICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnKSA6IGFnfVxuXG4sIGFzeW5jICogX2FvX2ZvcmsoKSB7XG4gICAgbGV0IHtmZW5jZX0gPSB0aGlzO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgciA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHIpIHtcbiAgICAgICAgICB5aWVsZCByO30gfSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcbiAgcmV0dXJuIGZ9XG5cblxuY29uc3QgYW9fZmVuY2Vfb2JqID0gLyogI19fUFVSRV9fICovXG4gIGFvX2ZlbmNlX3YuYmluZChudWxsLCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IC8qICNfX1BVUkVfXyAqLyBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG4sIF9hb19tYW55KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOyBjb25zaWRlciAuYW9fZm9yaygpIG9yIC5hbGxvd19tYW55KCknKX1cblxuLCBhbGxvd19tYW55KCkge1xuICAgIGxldCB7YW9fZm9yaywgYW9fYm91bmQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgaWYgKF9hb19tYW55ID09PSBhb19ib3VuZCkge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IGFvX2Zvcms7fVxuICAgIHRoaXMuX2FvX21hbnkgPSBhb19mb3JrO1xuICAgIHRoaXMuYWxsb3dfbWFueSA9ICgpID0+IHRoaXM7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMuYW9fYm91bmQoKSk7IH1cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgbGV0IHt4ZW1pdCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBfYW9fbWFueTtcbiAgICAgIHJldHVybiB4ZW1pdFxuICAgICAgICA/IF9hZ19jb3B5KGFnX291dCwgeGVtaXQoYWdfb3V0KSlcbiAgICAgICAgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmJpbmRfZ2F0ZWQoZl9nYXRlKS5hb19ib3VuZCgpfVxuXG4sIF9hb19nYXRlZChmX2dhdGUpIHtyZXR1cm4gYW9nX2dhdGVkKHRoaXMsIGZfZ2F0ZSl9IH0gKTtcblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19nYXRlZChmX291dCwgZl9nYXRlKSB7XG4gIHRyeSB7XG4gICAgZl9vdXQucmVzdW1lKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICB5aWVsZCB2O1xuICAgICAgZl9vdXQucmVzdW1lKHYpO30gfVxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9vdXQuYWJvcnQoKTtcbiAgICBpZiAoZl9nYXRlLmFib3J0KSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTt9IH0gfVxuXG5jb25zdCBhb19mZWVkZXIgPSAoe2dfaW59KSA9PiB2ID0+IGdfaW4ubmV4dCh2KTtcbmNvbnN0IGFvX2ZlZWRlcl92ID0gKHtnX2lufSkgPT4gKC4uLmFyZ3MpID0+IGdfaW4ubmV4dChhcmdzKTtcblxuXG5mdW5jdGlvbiBhb2dfZmVuY2VfeGYoeGluaXQsIC4uLmFyZ3MpIHtcbiAgbGV0IGZfaW4gPSBhb19mZW5jZV92KHt9KSwgZl9vdXQgPSBhb19mZW5jZV92KHt9KTtcbiAgbGV0IGdfaW4gPSB4aW5pdChmX2luLCBmX291dCwgLi4uYXJncyk7XG4gIGdfaW4ubmV4dCgpO1xuXG4gIGxldCByZXMgPSBhb2dfZ2F0ZWQoZl9vdXQsIGZfaW4pO1xuICByZXMuZmVuY2UgPSBmX291dC5mZW5jZTtcbiAgcmVzLmdfaW4gPSBnX2luO1xuICByZXR1cm4gcmVzfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9pdGVyKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGFvZ19mZW5jZV94Zihhb2dfaXRlciwgLi4uYXJncyl9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3NpbmsoLi4uYXJncykge1xuICByZXR1cm4gYW9nX2ZlbmNlX3hmKGFvZ19zaW5rLCAuLi5hcmdzKX1cblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0gKHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgZl9pbi5yZXN1bWUodGlwKTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX3NpbmsoZl9pbiwgZl9nYXRlLCB4Zikge1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICAge1xuICAgICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgICAgdGlwID0gKGF3YWl0IHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgICBmX2luLnJlc3VtZSh0aXApO31cblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZl9nYXRlKSB7XG4gICAgICAgIGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO30gfSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuY29uc3QgYW9feGZvcm0gPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb194Zm9ybShuc19nZW4pO1xuY29uc3QgYW9fZm9sZCA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX2ZvbGQobnNfZ2VuKTtcbmNvbnN0IGFvX3F1ZXVlID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUobnNfZ2VuKTtcblxuY29uc3QgYW9fZmVuY2VfaW4gPSAvKiAjX19QVVJFX18gKi8gYW9fZmVuY2Vfdi5iaW5kKG51bGwse1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17fSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4ZW1pdCwgeGluaXQsIHhyZWN2fSA9XG4gICAgICBpc19hb19mbihuc19nZW4pXG4gICAgICAgID8gbnNfZ2VuKHRoaXMsIGZfb3V0KVxuICAgICAgICA6IG5zX2dlbjtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhlbWl0KSB7XG4gICAgICBmX291dC54ZW1pdCA9IHhlbWl0O31cblxuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LFxuICAgICAgeHJlY3YgPyBfeGZfZ2VuLmNyZWF0ZSh4cmVjdikgOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGdfaW4gPSBmX291dC5nX2luID0gcmVzLmdfaW4gfHwgcmVzO1xuICAgIHJldHVybiByZXMgIT09IGdfaW5cbiAgICAgID8gcmVzIC8vIHJlcyBpcyBhbiBvdXRwdXQgZ2VuZXJhdG9yXG4gICAgICA6KC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgICAgICBnX2luLm5leHQoKSxcbiAgICAgICAgICBmX291dC5iaW5kX2dhdGVkKHRoaXMpKSB9XG5cbiwgLy8gRVMyMDE1IGdlbmVyYXRvciBhcGlcbiAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuLCByZXR1cm4oKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChhb19kb25lKSwgZG9uZTogdHJ1ZX19XG4sIHRocm93KGVycikge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoZXJyKSwgZG9uZTogdHJ1ZX19IH0gKTtcblxuXG5jb25zdCBfeGZfZ2VuID0ge1xuICBjcmVhdGUoeGYpIHtcbiAgICBsZXQgc2VsZiA9IHtfX3Byb3RvX186IHRoaXN9O1xuICAgIHNlbGYueGcgPSB4ZihzZWxmLnhmX2ludigpKTtcbiAgICByZXR1cm4gc2VsZn1cblxuLCAqeGZfaW52KCkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICBsZXQgdGlwID0gdGhpcy5fdGlwO1xuICAgICAgaWYgKHRoaXMgPT09IHRpcCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZGVyZmxvdycpfVxuICAgICAgZWxzZSB0aGlzLl90aXAgPSB0aGlzO1xuXG4gICAgICB5aWVsZCB0aXA7fSB9XG5cbiwgbmV4dCh2KSB7XG4gICAgdGhpcy5fdGlwID0gdjtcbiAgICByZXR1cm4gdGhpcy54Zy5uZXh0KHYpfVxuXG4sIHJldHVybigpIHt0aGlzLnhnLnJldHVybigpO31cbiwgdGhyb3coKSB7dGhpcy54Zy50aHJvdygpO30gfTtcblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBhb19pdGVyYWJsZSkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLndoZW5fcnVuID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgICAgcCA9IF9mZW5jZSgpO1xuICAgICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCB2KTt9XG5cbiAgICAgIGF3YWl0IHA7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhhb19pdGVyYWJsZSkge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXN1bWUpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBfZXZ0X2luaXQgPSBQcm9taXNlLnJlc29sdmUoe3R5cGU6J2luaXQnfSk7XG5mdW5jdGlvbiBhb19kb21fbGlzdGVuKHNlbGY9YW9fcXVldWUoKSkge1xuICByZXR1cm4gX2JpbmQuc2VsZiA9IHNlbGYgPXtcbiAgICBfX3Byb3RvX186IHNlbGZcbiAgLCB3aXRoX2RvbShkb20sIGZuKSB7XG4gICAgICByZXR1cm4gZG9tLmFkZEV2ZW50TGlzdGVuZXJcbiAgICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSl9IH1cblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgc2VsZi5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYWdfY29weSwgX2FvX2ZlbmNlX2NvcmVfYXBpXywgX2FvX2l0ZXJfZmVuY2VkLCBfYW9fcnVuLCBfYW9fdGFwLCBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXIsIGFvX2RlZmVyX2N0eCwgYW9fZGVmZXJfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZG9uZSwgYW9fZHJpdmUsIGFvX2ZlZWRlciwgYW9fZmVlZGVyX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9pbiwgYW9fZmVuY2VfaXRlciwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9vdXQsIGFvX2ZlbmNlX3NpbmssIGFvX2ZlbmNlX3YsIGFvX2ZvbGQsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlZCwgYW9fcXVldWUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9feGZvcm0sIGFvZ19mZW5jZV94ZiwgYW9nX2dhdGVkLCBhb2dfaXRlciwgYW9nX3NpbmssIGlzX2FvX2ZuLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiaW1wb3J0IHthc3NlcnQsIGlzX2ZufSBmcm9tICcuL191dGlscy5qc3knXG5cbmltcG9ydCB7YW9fZGVmZXIsIGFvX2RlZmVyX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX2ZlbmNlX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX2lufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtpdGVyLCBzdGVwX2l0ZXIsIGFvX2l0ZXIsIGFvX3N0ZXBfaXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcblxuZGVzY3JpYmUgQCAnc21va2UnLCBAOjpcbiAgaXQgQCAnZGVmZXInLCBAOjpcbiAgICBpc19mbiBAIGFvX2RlZmVyXG4gICAgaXNfZm4gQCBhb19kZWZlcl92XG5cbiAgaXQgQCAnZmVuY2UnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ZlbmNlX3ZcbiAgICBpc19mbiBAIGFvX2ZlbmNlX2ZuXG4gICAgaXNfZm4gQCBhb19mZW5jZV9vYmpcbiAgICBpc19mbiBAIGFvX2ZlbmNlX2luXG5cbiAgaXQgQCAnZHJpdmUnLCBAOjpcbiAgICBpc19mbiBAIGl0ZXJcbiAgICBpc19mbiBAIHN0ZXBfaXRlclxuICAgIGlzX2ZuIEAgYW9faXRlclxuICAgIGlzX2ZuIEAgYW9fc3RlcF9pdGVyXG4gICAgXG4gICAgaXNfZm4gQCBhb19ydW5cbiAgICBpc19mbiBAIGFvX2RyaXZlXG5cbiAgaXQgQCAnc3BsaXQnLCBAOjpcbiAgICBpc19mbiBAIGFvX3NwbGl0XG4gICAgaXNfZm4gQCBhb190YXBcblxuIiwiaW1wb3J0IHthb19kZWZlciwgYW9fZGVmZXJfdn0gZnJvbSAncm9hcCdcbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fZGVmZXInLCBAOjpcblxuICBkZXNjcmliZSBAICdhb19kZWZlcl92IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVyIG9iamVjdCcsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICAgIGV4cGVjdChyZXMucHJvbWlzZSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzLnJlc29sdmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMucmVqZWN0KS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcigpXG4gICAgICBsZXQgcCA9IHJlcy5wcm9taXNlXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcigpXG4gICAgICBsZXQgcCA9IHJlcy5wcm9taXNlXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG4iLCJpbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZScsIEA6OlxuXG4gIGl0IEAgJ2FvX3J1bicsIEA6Oj5cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fcnVuKGcpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgaXQgQCAnYW9fZHJpdmUgZ2VuZXJhdG9yJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnX3RndCA9IGdlbl90ZXN0KGxzdClcbiAgICBnX3RndC5uZXh0KCdmaXJzdCcpXG4gICAgZ190Z3QubmV4dCgnc2Vjb25kJylcbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnX3RndFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuICAgIGdfdGd0Lm5leHQoJ2ZpbmFsJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXVxuICAgICAgJ3NlY29uZCdcbiAgICAgIDE5NDJcbiAgICAgIDIwNDJcbiAgICAgIDIxNDJcbiAgICAgICdmaW5hbCdcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QobHN0KSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiAgaXQgQCAnYW9fZHJpdmUgZnVuY3Rpb24nLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ2VuX3Rlc3RcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXVxuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdCgpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuIiwiaW1wb3J0IHtpdGVyLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zdGVwX2l0ZXIsIHN0ZXBfaXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19nZW5cbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlIGl0ZXJzJywgQDo6XG5cbiAgaXQgQCAnbm9ybWFsIGl0ZXInLCBAOjpcbiAgICBsZXQgZyA9IGlzX2dlbiBAIGl0ZXIgQCMgMTAsIDIwLCAzMFxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGcubmV4dCgpXG5cblxuICBpdCBAICdhc3luYyBpdGVyJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9faXRlciBAIyAxMCwgMjAsIDMwXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgYXdhaXQgcFxuXG5cbiAgaXQgQCAnbm9ybWFsIHN0ZXBfaXRlcicsIEA6OlxuICAgIGxldCB6ID0gQXJyYXkuZnJvbSBAXG4gICAgICB6aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cbiAgICBmdW5jdGlvbiAqIHppcChhLCBiKSA6OlxuICAgICAgYiA9IHN0ZXBfaXRlcihiKVxuICAgICAgZm9yIGxldCBhdiBvZiBpdGVyKGEpIDo6XG4gICAgICAgIGZvciBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cblxuICBpdCBAICdhc3luYyBhb19zdGVwX2l0ZXInLCBAOjo+XG4gICAgbGV0IHogPSBhd2FpdCBhcnJheV9mcm9tX2FvX2l0ZXIgQFxuICAgICAgYW9femlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG5cbiAgICBhc3luYyBmdW5jdGlvbiAqIGFvX3ppcChhLCBiKSA6OlxuICAgICAgYiA9IGFvX3N0ZXBfaXRlcihiKVxuICAgICAgZm9yIGF3YWl0IGxldCBhdiBvZiBhb19pdGVyKGEpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cbiIsImltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGssXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIHNwbGl0JywgQDo6XG5cbiAgaXQgQCAnYW9fc3BsaXQgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19zcGxpdChnKVxuXG4gICAgICBleHBlY3QoZ3Mud2hlbl9ydW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMDQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIxNDIpXG5cbiAgICAgIGF3YWl0IGdzLndoZW5fcnVuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYSA9IGF3YWl0IGEsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYiA9IGF3YWl0IGIsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYyA9IGF3YWl0IGMsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGFzc2VydCBAIGEgIT09IGJcbiAgICAgIGFzc2VydCBAIGEgIT09IGNcbiAgICAgIGFzc2VydCBAIGIgIT09IGNcblxuXG4gIGl0IEAgJ2FvX3RhcCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgbGV0IFtmX291dCwgYWdfdGFwXSA9IGFvX3RhcChnKVxuICAgICAgaXNfYXN5bmNfaXRlcmFibGUgQCBmX291dFxuICAgICAgaXNfZ2VuIEAgYWdfdGFwXG5cbiAgICAgIGV4cGVjdChmX291dC5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGZfb3V0LmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihhZ190YXApXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYSA9IGF3YWl0IGEsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYiA9IGF3YWl0IGIsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYyA9IGF3YWl0IGMsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGFzc2VydCBAIGEgIT09IGJcbiAgICAgIGFzc2VydCBAIGEgIT09IGNcbiAgICAgIGFzc2VydCBAIGIgIT09IGNcblxuIiwiaW1wb3J0IHthb19mZW5jZV92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthc3NlcnQsIGV4cGVjdCwgZGVsYXlfcmFjZX0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3YgdHVwbGUnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfdigpXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ29ubHkgZmlyc3QgYWZ0ZXInLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG4gICAgbGV0IGZcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuICAgIGFzc2VydC5lcXVhbCBAICd0d28nLCBhd2FpdCBmXG5cbiAgICByZXN1bWUgQCAnZm91cidcbiAgICByZXN1bWUgQCAnZml2ZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICdzaXgnXG4gICAgcmVzdW1lIEAgJ3NldmVuJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3NpeCcsIGF3YWl0IGZcblxuXG4gIGl0IEAgJ25ldmVyIGJsb2NrZWQgb24gZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG5cbiAgaXQgQCAnZXhlcmNpc2UgZmVuY2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICBsZXQgdiA9ICdhJ1xuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYScpXG5cbiAgICBjb25zdCBwID0gQCE+XG4gICAgICB2ID0gJ2InXG5cbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdiYicpXG5cbiAgICAgIHYgPSAnYydcbiAgICAgIDo6IGNvbnN0IGFucyA9IGF3YWl0IGZlbmNlKClcbiAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdjYycpXG4gICAgICB2ID0gJ2QnXG4gICAgICByZXR1cm4gMTk0MlxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnZCcpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfZm59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5XG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9mbicsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9mbigpXG5cbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGlzX2ZlbmNlX2NvcmUocmVzWzBdKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSBmZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LCBcbiAgaXNfZmVuY2VfY29yZSxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vYmonLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX29iaigpXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzLnJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzLnJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfb3V0LCBhb19pdGVyLCBhb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSxcbiAgaXNfZmVuY2VfY29yZSxcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX291dCcsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9jb3JlIEAgYW9fZmVuY2Vfb3V0KClcbiAgICBleHBlY3QocmVzLmFvX2JvdW5kKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb19ydW4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmJpbmRfZ2F0ZWQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFsbG93X21hbnkpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2NoZWNrIG5vdCBib3VuZCBlcnJvcicsIEA6Oj5cbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KClcblxuICAgIHRyeSA6OlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhc3NlcnQuZmFpbCBAICdzaG91bGQgaGF2ZSByZXR1cm5lZCBhbiBlcnJvcidcbiAgICBjYXRjaCBlcnIgOjpcbiAgICAgIGlmIC9hb19mZW5jZV9vdXQgbm90IGJvdW5kLy50ZXN0KGVyci5tZXNzYWdlKSA6OlxuICAgICAgICAvLyB3b3JrZWRcbiAgICAgIGVsc2UgdGhyb3cgZXJyXG5cblxuICBpdCBAICdjaGVjayBhbHJlYWR5IGJvdW5kIGVycm9yJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuXG4gICAgdHJ5IDo6XG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXNzZXJ0LmZhaWwgQCAnc2hvdWxkIGhhdmUgcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgY2F0Y2ggZXJyIDo6XG4gICAgICBpZiAvYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOy8udGVzdChlcnIubWVzc2FnZSkgOjpcbiAgICAgICAgLy8gd29ya2VkXG4gICAgICBlbHNlIHRocm93IGVyclxuXG4gIGl0IEAgJ2FsbG93X21hbnkoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG5cbiAgaXQgQCAnYW9fZm9yaygpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX2JvdW5kKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2JvdW5kKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICBpdCBAICdhb19ydW4oKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGxldCBwID0gZi5hb19ydW4oKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICBleHBlY3QoZi53aGVuX3J1bikudG8uZXF1YWwocClcblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19mZW5jZV9nZW4sXG4gIGRlbGF5X3JhY2UsIGRlbGF5XG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbicsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGlzX2ZlbmNlX2dlbiBAIGFvX2ZlbmNlX2luKClcbiAgICBleHBlY3QocmVzLmFvX3hmb3JtKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb19mb2xkKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb19xdWV1ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9nX2l0ZXIpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19zaW5rKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzLnJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbiwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbigpLmFvX3hmb3JtKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9feGZvcm0oKVxuXG4gICAgaXNfZ2VuIEAgc29tZV9waXBlLmdfaW5cbiAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2ltcGxlJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneHJlY3Ygc3VtIHByZSB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgIGFzeW5jICogeGVtaXQoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hpbml0IGNvbnRleHQgZ19pbicsIEA6Oj5cbiAgICBsZXQgbG9nPVtdXG5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSBAOlxuICAgICAgKnhpbml0KGdfaW4pIDo6XG4gICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggc3RhcnQnXG4gICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgdiA9PiBnX2luLm5leHQodilcbiAgICAgICAgICAxLCAnYmluZ28nXG5cbiAgICAgICAgdHJ5IDo6XG4gICAgICAgICAgeWllbGQgKiBnX2luLmFvZ19pdGVyKClcbiAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgIGNsZWFyVGltZW91dCh0aWQpXG4gICAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBmaW4nXG5cbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnXG5cbiAgICBhd2FpdCBkZWxheSg1KVxuICAgIHNvbWVfcGlwZS5nX2luLnJldHVybigpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnLCAneGN0eCBmaW4nXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdICdiaW5nbydcblxuXG4gIGFzeW5jIGZ1bmN0aW9uIF90ZXN0X3BpcGVfb3V0KHNvbWVfcGlwZSwgdmFsdWVzKSA6OlxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgc29tZV9waXBlLmdfaW4sIHRydWVcblxuICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbiwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbigpLmFvX2ZvbGQoKScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9waXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19mb2xkKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkKClcbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneHJlY3Ygc3VtIHByZSB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgKnhyZWN2KGcpIDo6XG4gICAgICAgIGxldCBzID0gMFxuICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHMgKz0gdlxuICAgICAgICAgIHlpZWxkIHNcblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDE5NDIrMjA0MiwgMTk0MisyMDQyKzIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4ZW1pdCBwb3N0IHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgKnhpbml0KGdfaW4pIDo6XG4gICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggc3RhcnQnXG4gICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgdiA9PiBnX2luLm5leHQodilcbiAgICAgICAgICAxLCAnYmluZ28nXG5cbiAgICAgICAgdHJ5IDo6XG4gICAgICAgICAgeWllbGQgKiBnX2luLmFvZ19pdGVyKClcbiAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgIGNsZWFyVGltZW91dCh0aWQpXG4gICAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBmaW4nXG5cbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnXG5cbiAgICBhd2FpdCBkZWxheSg1KVxuICAgIHNvbWVfcGlwZS5nX2luLnJldHVybigpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnLCAneGN0eCBmaW4nXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdICdiaW5nbydcblxuXG4gIGFzeW5jIGZ1bmN0aW9uIF90ZXN0X3BpcGVfb3V0KHNvbWVfcGlwZSwgdmFsdWVzKSA6OlxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgc29tZV9waXBlLmdfaW4sIHRydWVcblxuICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbiwgYW9faXRlciwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGRlbGF5X3dhbGssIGFycmF5X2Zyb21fYW9faXRlcixcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbigpLmFvX3F1ZXVlKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcXVldWUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKClcblxuICAgIGlzX2dlbihzb21lX3F1ZXVlLmdfaW4pXG4gICAgZXhwZWN0KHNvbWVfcXVldWUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW5nbGVzJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBsZXQgcF9vdXQxID0gYW9faXRlcihzb21lX3F1ZXVlKS5uZXh0KClcbiAgICBleHBlY3QocF9vdXQxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgIGV4cGVjdChwX2luMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5kZWVwLmVxdWFsIEA6XG4gICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9pbigpLmFvX3F1ZXVlIEA6XG4gICAgICBhc3luYyAqIHhyZWN2KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcXVldWUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMFxuICAgICAgc29tZV9xdWV1ZS5nX2luXG5cbiAgICBhd2FpdCBzb21lX3F1ZXVlLmdfaW4ucmV0dXJuKClcblxuICAgIGV4cGVjdChhd2FpdCBvdXQpLnRvLmRlZXAuZXF1YWwgQCNcbiAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19mZW5jZV9zaW5rLCBhb19mZW5jZV9pdGVyLCBhb19kcml2ZSwgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV9yYWNlLCBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZmVuY2VfYmFyZScsIGZ1bmN0aW9uKCkgOjpcblxuICBkZXNjcmliZSBAICdhb19mZW5jZV9zaW5rKCknLCBmdW5jdGlvbigpIDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19mZW5jZV9zaW5rKClcblxuICAgICAgaXNfZ2VuKHNvbWVfcXVldWUuZ19pbilcbiAgICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICdzaW5nbGVzJywgQDo6PlxuICAgICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9zaW5rKClcblxuICAgICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgICBleHBlY3QocF9vdXQxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHBfaW4xID0gc29tZV9xdWV1ZS5nX2luLm5leHQgQCAnZmlyc3QnXG4gICAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5kZWVwLmVxdWFsIEA6XG4gICAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG4gICAgaXQgQCAndmVjJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3F1ZXVlID0gYW9fZmVuY2Vfc2luaygpXG4gICAgICBsZXQgc2Vjb25kX3F1ZXVlID0gQCEqPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmlyc3RfcXVldWUgOjpcbiAgICAgICAgICB5aWVsZCAxMDAwK3ZcblxuICAgICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzZWNvbmRfcXVldWUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgICAgZmlyc3RfcXVldWUuZ19pblxuXG4gICAgICBhd2FpdCBmaXJzdF9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICAgIGV4cGVjdChhd2FpdCBvdXQpLnRvLmRlZXAuZXF1YWwgQCNcbiAgICAgICAgMTAyNSwgMTA1MCwgMTA3NSwgMTEwMFxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2VfaXRlcigpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9waXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19mZW5jZV9pdGVyKClcblxuICAgICAgaXNfZ2VuIEAgc29tZV9waXBlLmdfaW5cbiAgICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pdGVyKClcbiAgICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gICAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgICBsZXQgZmlyc3RfcGlwZSA9IGFvX2ZlbmNlX2l0ZXIoKVxuICAgICAgbGV0IHNlY29uZF9waXBlID0gQCEqPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmlyc3RfcGlwZSA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgICBzZWNvbmRfcGlwZS5nX2luID0gZmlyc3RfcGlwZS5nX2luXG5cbiAgICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzZWNvbmRfcGlwZSxcbiAgICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgICAgc29tZV9waXBlLmdfaW4sIHRydWVcblxuICAgICAgcmV0dXJuIHpcblxuXG4iLCJpbXBvcnQge2FvX2ludGVydmFsLCBhb190aW1lb3V0LCBhb19kZWJvdW5jZSwgYW9fdGltZXMsIGFvX2l0ZXJfZmVuY2VkLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ3RpbWUnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ludGVydmFsXG4gICAgaXNfZm4gQCBhb190aW1lb3V0XG4gICAgaXNfZm4gQCBhb190aW1lc1xuXG5cbiAgaXQgQCAnYW9faW50ZXJ2YWwnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ludGVydmFsKDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb190aW1lb3V0JywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb190aW1lb3V0KDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb19kZWJvdW5jZScsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZGVib3VuY2UoMTAsIFszMCwgMjAsIDEwLCAxNV0pXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIGV4cGVjdChhb3Qud2hlbl9ydW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGFzc2VydC5lcXVhbCgxNSwgdmFsdWUpXG5cbiAgICBhd2FpdCBhb3Qud2hlbl9ydW5cblxuXG4gIGl0IEAgJ2FvX2l0ZXJfZmVuY2VkIHdpdGggYW9faW50ZXJ2YWwgYXMgcmF0ZSBsaW1pdCcsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAXG4gICAgICBhb19pdGVyX2ZlbmNlZCBAXG4gICAgICAgIFszMCwgMjAsIDEwLCAxNV1cbiAgICAgICAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgZXhwZWN0KHZhbHVlKS50by5lcXVhbCgzMClcblxuICAgIGxldCBsc3QgPSBbdmFsdWVdXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgIGxzdC5wdXNoKHYpXG5cbiAgICBleHBlY3QobHN0KS50by5kZWVwLmVxdWFsIEBcbiAgICAgIFszMCwgMjAsIDEwLCAxNV1cblxuXG4gIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19pbnRlcnZhbCgxMClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fYW5pbWF0aW9uLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gYW5pbWF0aW9uIGZyYW1lcycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2FuaW1hdGlvblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDo6XG5cbiAgICBpdCBAICdhb19kb21fYW5pbWF0aW9uJywgQDo6PlxuICAgICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2FuaW1hdGlvbigpXG4gICAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh2YWx1ZSA+PSAwKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcblxuICAgIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2RvbV9hbmltYXRpb24oKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9saXN0ZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBhcnJheV9mcm9tX2FvX2l0ZXJcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gZXZlbnRzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fbGlzdGVuXG5cbiAgICBsZXQgZGUgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9saXN0ZW4oKVxuICAgIGlzX2dlbiBAIGRlLmdfaW5cbiAgICBpc19mbiBAIGRlLndpdGhfZG9tXG5cblxuICBpdCBAICdzaGFwZSBvZiB3aXRoX2RvbScsIEA6OlxuICAgIGxldCBtb2NrID0gQHt9XG4gICAgICBhZGRFdmVudExpc3RlbmVyKGV2dCwgZm4sIG9wdCkgOjpcblxuICAgIGxldCBlX2N0eCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgLndpdGhfZG9tKG1vY2spXG5cbiAgICBpc19mbiBAIGVfY3R4LndpdGhfZG9tXG4gICAgaXNfZm4gQCBlX2N0eC5saXN0ZW5cblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgOjpcblxuICAgIGl0IEAgJ21lc3NhZ2UgY2hhbm5lbHMnLCBAOjo+XG4gICAgICBjb25zdCB7cG9ydDEsIHBvcnQyfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpXG5cbiAgICAgIGNvbnN0IGFvX3RndCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYW9fdGd0KVxuXG4gICAgICBhb190Z3RcbiAgICAgICAgLndpdGhfZG9tIEAgcG9ydDIsIHZvaWQgcG9ydDIuc3RhcnQoKVxuICAgICAgICAubGlzdGVuIEAgJ21lc3NhZ2UnLCBldnQgPT4gQDogdGVzdF9uYW1lOiBldnQuZGF0YVxuXG4gICAgICA6OiE+XG4gICAgICAgIGZvciBsZXQgbSBvZiBbJ2EnLCAnYicsICdjJ10gOjpcbiAgICAgICAgICBwb3J0MS5wb3N0TWVzc2FnZSBAIGBmcm9tIG1zZyBwb3J0MTogJHttfWBcbiAgICAgICAgICBhd2FpdCBkZWxheSgxKVxuXG4gICAgICAgIGFvX3RndC5nX2luLnJldHVybigpXG4gICAgICAgIHBvcnQxLmNsb3NlKClcblxuICAgICAgbGV0IGV4cGVjdGVkID0gQFtdXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYSdcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBiJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGMnXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsKGV4cGVjdGVkKVxuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0VBQUEsbUNBQW1DLE1BQU07OztJQUl2QyxZQUFhO01BQ1gsV0FBWSxPQUFROzs7SUFHdEIsY0FBZTs7O0lBR2Y7ZUFDUztNQUNQO01BQ0E7OztJQUdGLG1CQUFtQixVQUFVO0lBQzdCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBOztJQUVBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ25ERixNQUFNLFVBQVUsR0FBRyxDQUFDO0VBQ3BCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbEM7RUFDQSxNQUFNLFFBQVEsR0FBRyxJQUFJO0VBQ3JCLEVBQUUsVUFBVSxLQUFLLE9BQU8sSUFBSTtFQUM1QixPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFD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LENBQUM7RUFDN0IsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDO0VBQ3RCLFVBQVUsTUFBTSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7RUFDN0IsVUFBVSxNQUFNLENBQUM7QUFDakI7RUFDQSxJQUFJLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRTtFQUM3QixNQUFNLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFDM0I7RUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLENBQUM7RUFDcEMsSUFBSSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUs7RUFDL0IsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztBQUNqRDtFQUNBLElBQUksSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQztFQUM1QyxJQUFJLE9BQU8sR0FBRyxLQUFLLElBQUk7RUFDdkIsUUFBUSxHQUFHO0VBQ1g7RUFDQSxVQUFVLElBQUksQ0FBQyxJQUFJLEVBQUU7RUFDckIsVUFBVSxLQUFLLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDbkM7RUFDQTtFQUNBLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDdEQsRUFBRSxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0VBQzVELEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFH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
