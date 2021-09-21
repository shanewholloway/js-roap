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
    let res = aog_gated(f_out, f_in);
    let g_in = xinit(f_in, f_out, ...args);
    g_in.next();

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

      let ag_out, g_in = res.g_in || res;
      if (res === g_in) {
        // res is an input generator
        g_in.next();
        ag_out = f_out.bind_gated(this);}

      else {
        // res is an output generator
        ag_out = res;}

      ag_out.g_in = f_out.g_in = g_in;
      return ag_out}


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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb3V0LmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC94Zm9ybS5qc3kiLCIuLi91bml0L2ZvbGQuanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L2ZlbmNlX2JhcmUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2NvcmUoZikgOjpcbiAgaXNfZm4oZi5mZW5jZSlcbiAgaXNfZm4oZi5hb19mb3JrKVxuICBpc19hc3luY19pdGVyYWJsZShmKVxuXG4gIGlzX2ZuKGYuYW9fY2hlY2tfZG9uZSlcbiAgLy8gaXNfZm4oZi5jaGFpbikgLS0gbW92ZWQgdG8gZXhwZXJpbWVudGFsL2NoYWluLm1kXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19mZW5jZV9nZW4oZikgOjpcbiAgaXNfZmVuY2VfY29yZShmKVxuICBpc19mbihmLmFib3J0KVxuICBpc19mbihmLnJlc3VtZSlcblxuICBpc19nZW4oZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IGlzX2FvX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcblxuXG5jb25zdCBhb19kb25lID0gT2JqZWN0LmZyZWV6ZSh7YW9fZG9uZTogdHJ1ZX0pO1xuY29uc3QgYW9fY2hlY2tfZG9uZSA9IGVyciA9PiB7XG4gIGlmIChlcnIgIT09IGFvX2RvbmUgJiYgZXJyICYmICFlcnIuYW9fZG9uZSkge1xuICAgIHRocm93IGVycn1cbiAgcmV0dXJuIHRydWV9O1xuXG5cbmNvbnN0IF9hZ19jb3B5ID0gKHtnX2lufSwgYWdfb3V0KSA9PihcbiAgdW5kZWZpbmVkID09PSBnX2luID8gYWdfb3V0IDooXG4gICAgYWdfb3V0LmdfaW4gPSBnX2luXG4gICwgYWdfb3V0KSApO1xuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBhc19yZXMocCwgeSwgbikpIH1cblxuY29uc3QgYW9fZGVmZXJfdiA9IC8qICNfX1BVUkVfXyAqLyBhb19kZWZlcl9jdHgoKTtcblxuY29uc3QgYW9fZGVmZXIgPSAvKiAjX19QVVJFX18gKi9cbiAgYW9fZGVmZXJfY3R4KChwLHksbikgPT5cbiAgICAoe3Byb21pc2U6IHAsIHJlc29sdmU6IHksIHJlamVjdDogbn0pKTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb19pdGVyX2ZlbmNlZChpdGVyYWJsZSwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgIGF3YWl0IGY7XG4gICAgeWllbGQgdjtcbiAgICBmID0gZl9nYXRlLmZlbmNlKCk7fSB9XG5cblxuY29uc3QgYW9faXRlcl9mZW5jZWQgPSAoLi4uYXJncykgPT5cbiAgX2FnX2NvcHkoYXJnc1swXSwgX2FvX2l0ZXJfZmVuY2VkKC4uLmFyZ3MpKTtcblxuZnVuY3Rpb24gYW9fZmVuY2Vfdihwcm90bykge1xuICBsZXQgcmVzZXQgPSBhb19kZWZlcl9jdHgoKSwgeD1yZXNldCgpLCBwPTA7XG5cbiAgbGV0IGZlbmNlICA9ICgpID0+KDAgIT09IHAgPyBwIDogcD0oeD1yZXNldCgpKVswXSk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4ge3A9MDsgeFsxXShhbnMpO307XG4gIGxldCBhYm9ydCAgPSBlcnIgPT4ge3A9MDsgeFsyXShlcnIpO307XG5cbiAgcmV0dXJuIHByb3RvXG4gICAgP3tfX3Byb3RvX186IHByb3RvLCBmZW5jZSwgcmVzdW1lLCBhYm9ydH1cbiAgICA6W2ZlbmNlLCByZXN1bWUsIGFib3J0XSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID0ge1xuICBhb19jaGVja19kb25lXG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSB0aGlzLl9hb19mb3JrKCk7XG4gICAgbGV0IHt4ZW1pdH0gPSB0aGlzO1xuICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnKSA6IGFnfVxuXG4sIGFzeW5jICogX2FvX2ZvcmsoKSB7XG4gICAgbGV0IHtmZW5jZX0gPSB0aGlzO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgciA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHIpIHtcbiAgICAgICAgICB5aWVsZCByO30gfSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcbiAgcmV0dXJuIGZ9XG5cblxuY29uc3QgYW9fZmVuY2Vfb2JqID0gLyogI19fUFVSRV9fICovXG4gIGFvX2ZlbmNlX3YuYmluZChudWxsLCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcblxuZnVuY3Rpb24gYW9fc3BsaXQoaXRlcmFibGUpIHtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGZfb3V0LndoZW5fcnVuID0gX2FvX3J1bihpdGVyYWJsZSwgZl9vdXQpO1xuICBmX291dC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIGZfb3V0fVxuXG5hc3luYyBmdW5jdGlvbiBfYW9fcnVuKGl0ZXJhYmxlLCBmX3RhcCkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGZfdGFwLnJlc3VtZSh2KTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7XG4gICAgICB5aWVsZCB2O30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGZfdGFwLmFib3J0KCk7fSB9XG5cbmNvbnN0IGFvX2ZlbmNlX291dCA9IC8qICNfX1BVUkVfXyAqLyBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG4sIF9hb19tYW55KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOyBjb25zaWRlciAuYW9fZm9yaygpIG9yIC5hbGxvd19tYW55KCknKX1cblxuLCBhbGxvd19tYW55KCkge1xuICAgIGxldCB7YW9fZm9yaywgYW9fYm91bmQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgaWYgKF9hb19tYW55ID09PSBhb19ib3VuZCkge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IGFvX2Zvcms7fVxuICAgIHRoaXMuX2FvX21hbnkgPSBhb19mb3JrO1xuICAgIHRoaXMuYWxsb3dfbWFueSA9ICgpID0+IHRoaXM7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMuYW9fYm91bmQoKSk7IH1cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgbGV0IHt4ZW1pdCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBfYW9fbWFueTtcbiAgICAgIHJldHVybiB4ZW1pdFxuICAgICAgICA/IF9hZ19jb3B5KGFnX291dCwgeGVtaXQoYWdfb3V0KSlcbiAgICAgICAgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmJpbmRfZ2F0ZWQoZl9nYXRlKS5hb19ib3VuZCgpfVxuXG4sIF9hb19nYXRlZChmX2dhdGUpIHtyZXR1cm4gYW9nX2dhdGVkKHRoaXMsIGZfZ2F0ZSl9IH0gKTtcblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19nYXRlZChmX291dCwgZl9nYXRlKSB7XG4gIHRyeSB7XG4gICAgZl9vdXQucmVzdW1lKCk7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICB5aWVsZCB2O1xuICAgICAgZl9vdXQucmVzdW1lKHYpO30gfVxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9vdXQuYWJvcnQoKTtcbiAgICBpZiAoZl9nYXRlLmFib3J0KSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTt9IH0gfVxuXG5jb25zdCBhb19mZWVkZXIgPSAoe2dfaW59KSA9PiB2ID0+IGdfaW4ubmV4dCh2KTtcbmNvbnN0IGFvX2ZlZWRlcl92ID0gKHtnX2lufSkgPT4gKC4uLmFyZ3MpID0+IGdfaW4ubmV4dChhcmdzKTtcblxuXG5mdW5jdGlvbiBhb2dfZmVuY2VfeGYoeGluaXQsIC4uLmFyZ3MpIHtcbiAgbGV0IGZfaW4gPSBhb19mZW5jZV92KHt9KSwgZl9vdXQgPSBhb19mZW5jZV92KHt9KTtcbiAgbGV0IHJlcyA9IGFvZ19nYXRlZChmX291dCwgZl9pbik7XG4gIGxldCBnX2luID0geGluaXQoZl9pbiwgZl9vdXQsIC4uLmFyZ3MpO1xuICBnX2luLm5leHQoKTtcblxuICByZXMuZmVuY2UgPSBmX291dC5mZW5jZTtcbiAgcmVzLmdfaW4gPSBnX2luO1xuICByZXR1cm4gcmVzfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9pdGVyKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIGFvZ19mZW5jZV94Zihhb2dfaXRlciwgLi4uYXJncyl9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3NpbmsoLi4uYXJncykge1xuICByZXR1cm4gYW9nX2ZlbmNlX3hmKGFvZ19zaW5rLCAuLi5hcmdzKX1cblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGZfaW4sIGZfZ2F0ZSwgeGYpIHtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0gKHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgZl9pbi5yZXN1bWUodGlwKTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX3NpbmsoZl9pbiwgZl9nYXRlLCB4Zikge1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICAge1xuICAgICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgICAgdGlwID0gKGF3YWl0IHhmLm5leHQodGlwKSkudmFsdWU7fVxuICAgICAgICBmX2luLnJlc3VtZSh0aXApO31cblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZl9nYXRlKSB7XG4gICAgICAgIGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO30gfSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuY29uc3QgYW9feGZvcm0gPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb194Zm9ybShuc19nZW4pO1xuY29uc3QgYW9fZm9sZCA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX2ZvbGQobnNfZ2VuKTtcbmNvbnN0IGFvX3F1ZXVlID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUobnNfZ2VuKTtcblxuY29uc3QgYW9fZmVuY2VfaW4gPSAvKiAjX19QVVJFX18gKi8gYW9fZmVuY2Vfdi5iaW5kKG51bGwse1xuICBfX3Byb3RvX186IF9hb19mZW5jZV9jb3JlX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17fSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4ZW1pdCwgeGluaXQsIHhyZWN2fSA9XG4gICAgICBpc19hb19mbihuc19nZW4pXG4gICAgICAgID8gbnNfZ2VuKHRoaXMsIGZfb3V0KVxuICAgICAgICA6IG5zX2dlbjtcblxuICAgIGlmICh1bmRlZmluZWQgIT09IHhlbWl0KSB7XG4gICAgICBmX291dC54ZW1pdCA9IHhlbWl0O31cblxuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LFxuICAgICAgeHJlY3YgPyBfeGZfZ2VuLmNyZWF0ZSh4cmVjdikgOiB1bmRlZmluZWQpO1xuXG4gICAgbGV0IGFnX291dCwgZ19pbiA9IHJlcy5nX2luIHx8IHJlcztcbiAgICBpZiAocmVzID09PSBnX2luKSB7XG4gICAgICAvLyByZXMgaXMgYW4gaW5wdXQgZ2VuZXJhdG9yXG4gICAgICBnX2luLm5leHQoKTtcbiAgICAgIGFnX291dCA9IGZfb3V0LmJpbmRfZ2F0ZWQodGhpcyk7fVxuXG4gICAgZWxzZSB7XG4gICAgICAvLyByZXMgaXMgYW4gb3V0cHV0IGdlbmVyYXRvclxuICAgICAgYWdfb3V0ID0gcmVzO31cblxuICAgIGFnX291dC5nX2luID0gZl9vdXQuZ19pbiA9IGdfaW47XG4gICAgcmV0dXJuIGFnX291dH1cblxuXG4sIC8vIEVTMjAxNSBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9ICk7XG5cblxuY29uc3QgX3hmX2dlbiA9IHtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDApIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXN1bWUsIF9hYm9ydF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc3VtZSwgbXMsIDEpO1xuICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICBfZmVuY2Uuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJJbnRlcnZhbCh0aWQpO1xuICAgIF9hYm9ydCgpO30pO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgYW9faXRlcmFibGUpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbigpO1xuXG4gIF9mZW5jZS53aGVuX3J1biA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcDtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgYW9faXRlcmFibGUpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7fVxuXG4gICAgICBhd2FpdCBwO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoYW9faXRlcmFibGUpIHtcbiAgbGV0IHRzMCA9IERhdGUubm93KCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgYW9faXRlcmFibGUpIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcblxuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzdW1lKTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihzZWxmPWFvX3F1ZXVlKCkpIHtcbiAgcmV0dXJuIF9iaW5kLnNlbGYgPSBzZWxmID17XG4gICAgX19wcm90b19fOiBzZWxmXG4gICwgd2l0aF9kb20oZG9tLCBmbikge1xuICAgICAgcmV0dXJuIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICAgID8gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKVxuICAgICAgICA6IF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBkb20pfSB9XG5cbiAgZnVuY3Rpb24gX2JpbmQoZG9tLCBmbl9ldnQsIGZuX2RvbSkge1xuICAgIHJldHVybiBldnQgPT4ge1xuICAgICAgbGV0IHYgPSBmbl9ldnRcbiAgICAgICAgPyBmbl9ldnQoZXZ0LCBkb20sIGZuX2RvbSlcbiAgICAgICAgOiBmbl9kb20oZG9tLCBldnQpO1xuXG4gICAgICBpZiAobnVsbCAhPSB2KSB7XG4gICAgICAgIHNlbGYuZ19pbi5uZXh0KHYpO30gfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pIHtcbiAgbGV0IF9vbl9ldnQ7XG4gIGlmIChpc19hb19mbihmbikpIHtcbiAgICBfZXZ0X2luaXQudGhlbihcbiAgICAgIF9vbl9ldnQgPSBfYmluZChkb20sIHZvaWQgMCwgZm4pKTsgfVxuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGxldCBvcHQsIGV2dF9mbiA9IF9vbl9ldnQ7XG5cbiAgICAgIGxldCBsYXN0ID0gYXJncy5wb3AoKTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBldnRfZm4gPSBfYmluZChkb20sIGxhc3QsIF9vbl9ldnQpO1xuICAgICAgICBsYXN0ID0gYXJncy5wb3AoKTt9XG5cbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgYXJncy5wdXNoKGxhc3QpO31cbiAgICAgIGVsc2Ugb3B0ID0gbGFzdDtcblxuICAgICAgZm9yIChsZXQgZXZ0IG9mIGFyZ3MpIHtcbiAgICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgZXZ0LCBldnRfZm4sIG9wdCk7IH1cblxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBlY3R4X2xpc3QpIHtcbiAgZWN0eF9saXN0ID0gQXJyYXkuZnJvbShlY3R4X2xpc3QsXG4gICAgZG9tID0+IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkpO1xuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGZvciAobGV0IGVjdHggb2YgZWN0eF9saXN0KSB7XG4gICAgICAgIGVjdHgubGlzdGVuKC4uLmFyZ3MpO31cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuZXhwb3J0IHsgX2FnX2NvcHksIF9hb19mZW5jZV9jb3JlX2FwaV8sIF9hb19pdGVyX2ZlbmNlZCwgX2FvX3J1biwgX2FvX3RhcCwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVyLCBhb19kZWZlcl9jdHgsIGFvX2RlZmVyX3YsIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9saXN0ZW4sIGFvX2RvbmUsIGFvX2RyaXZlLCBhb19mZWVkZXIsIGFvX2ZlZWRlcl92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfaW4sIGFvX2ZlbmNlX2l0ZXIsIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2Vfb3V0LCBhb19mZW5jZV9zaW5rLCBhb19mZW5jZV92LCBhb19mb2xkLCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9faXRlcl9mZW5jZWQsIGFvX3F1ZXVlLCBhb19ydW4sIGFvX3NwbGl0LCBhb19zdGVwX2l0ZXIsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGFvX3hmb3JtLCBhb2dfZmVuY2VfeGYsIGFvZ19nYXRlZCwgYW9nX2l0ZXIsIGFvZ19zaW5rLCBpc19hb19mbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImltcG9ydCB7YXNzZXJ0LCBpc19mbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5pbXBvcnQge2FvX2RlZmVyLCBhb19kZWZlcl92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19mZW5jZV92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9pbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7aXRlciwgc3RlcF9pdGVyLCBhb19pdGVyLCBhb19zdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmRlc2NyaWJlIEAgJ3Ntb2tlJywgQDo6XG4gIGl0IEAgJ2RlZmVyJywgQDo6XG4gICAgaXNfZm4gQCBhb19kZWZlclxuICAgIGlzX2ZuIEAgYW9fZGVmZXJfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG4gICAgaXNfZm4gQCBhb19mZW5jZV9pblxuXG4gIGl0IEAgJ2RyaXZlJywgQDo6XG4gICAgaXNfZm4gQCBpdGVyXG4gICAgaXNfZm4gQCBzdGVwX2l0ZXJcbiAgICBpc19mbiBAIGFvX2l0ZXJcbiAgICBpc19mbiBAIGFvX3N0ZXBfaXRlclxuICAgIFxuICAgIGlzX2ZuIEAgYW9fcnVuXG4gICAgaXNfZm4gQCBhb19kcml2ZVxuXG4gIGl0IEAgJ3NwbGl0JywgQDo6XG4gICAgaXNfZm4gQCBhb19zcGxpdFxuICAgIGlzX2ZuIEAgYW9fdGFwXG5cbiIsImltcG9ydCB7YW9fZGVmZXIsIGFvX2RlZmVyX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVyJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcl92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVyX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVyX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG5cblxuICBkZXNjcmliZSBAICdhb19kZWZlciBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXIoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1bihnKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3RcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBnX3RndC5uZXh0KCdmaW5hbCcpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgICdzZWNvbmQnXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG4gICAgICAnZmluYWwnXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KGxzdCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4gIGl0IEAgJ2FvX2RyaXZlIGZ1bmN0aW9uJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdlbl90ZXN0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgIDE5NDJcbiAgICAgIDIwNDJcbiAgICAgIDIxNDJcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QoKSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiIsImltcG9ydCB7aXRlciwgYW9faXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3RlcF9pdGVyLCBzdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZ2VuXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZSBpdGVycycsIEA6OlxuXG4gIGl0IEAgJ25vcm1hbCBpdGVyJywgQDo6XG4gICAgbGV0IGcgPSBpc19nZW4gQCBpdGVyIEAjIDEwLCAyMCwgMzBcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBnLm5leHQoKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlcicsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX2l0ZXIgQCMgMTAsIDIwLCAzMFxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGF3YWl0IHBcblxuXG4gIGl0IEAgJ25vcm1hbCBzdGVwX2l0ZXInLCBAOjpcbiAgICBsZXQgeiA9IEFycmF5LmZyb20gQFxuICAgICAgemlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG4gICAgZnVuY3Rpb24gKiB6aXAoYSwgYikgOjpcbiAgICAgIGIgPSBzdGVwX2l0ZXIoYilcbiAgICAgIGZvciBsZXQgYXYgb2YgaXRlcihhKSA6OlxuICAgICAgICBmb3IgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG5cbiAgaXQgQCAnYXN5bmMgYW9fc3RlcF9pdGVyJywgQDo6PlxuICAgIGxldCB6ID0gYXdhaXQgYXJyYXlfZnJvbV9hb19pdGVyIEBcbiAgICAgIGFvX3ppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gKiBhb196aXAoYSwgYikgOjpcbiAgICAgIGIgPSBhb19zdGVwX2l0ZXIoYilcbiAgICAgIGZvciBhd2FpdCBsZXQgYXYgb2YgYW9faXRlcihhKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG4iLCJpbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBzcGxpdCcsIEA6OlxuXG4gIGl0IEAgJ2FvX3NwbGl0IHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjA0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMTQyKVxuXG4gICAgICBhd2FpdCBncy53aGVuX3J1blxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cblxuICBpdCBAICdhb190YXAgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBbZl9vdXQsIGFnX3RhcF0gPSBhb190YXAoZylcbiAgICAgIGlzX2FzeW5jX2l0ZXJhYmxlIEAgZl9vdXRcbiAgICAgIGlzX2dlbiBAIGFnX3RhcFxuXG4gICAgICBleHBlY3QoZl9vdXQuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBmX291dC5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0KVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYWdfdGFwKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YXNzZXJ0LCBleHBlY3QsIGRlbGF5X3JhY2V9IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV92IHR1cGxlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3YoKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdvbmx5IGZpcnN0IGFmdGVyJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuICAgIGxldCBmXG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndHdvJywgYXdhaXQgZlxuXG4gICAgcmVzdW1lIEAgJ2ZvdXInXG4gICAgcmVzdW1lIEAgJ2ZpdmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAnc2l4J1xuICAgIHJlc3VtZSBAICdzZXZlbidcblxuICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG5cblxuICBpdCBAICduZXZlciBibG9ja2VkIG9uIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuXG4gIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgbGV0IHYgPSAnYSdcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgY29uc3QgcCA9IEAhPlxuICAgICAgdiA9ICdiJ1xuXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnYmInKVxuXG4gICAgICB2ID0gJ2MnXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnY2MnKVxuICAgICAgdiA9ICdkJ1xuICAgICAgcmV0dXJuIDE5NDJcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2QnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2ZufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsIFxuICBpc19mZW5jZV9jb3JlLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfZm4nLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpc19mZW5jZV9jb3JlKHJlc1swXSlcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZS5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb2JqJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZlbmNlX2NvcmUgQCBhb19mZW5jZV9vYmooKVxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX291dCwgYW9faXRlciwgYW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsXG4gIGlzX2ZlbmNlX2NvcmUsXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vdXQnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX291dCgpXG4gICAgZXhwZWN0KHJlcy5hb19ib3VuZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5iaW5kX2dhdGVkKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hbGxvd19tYW55KS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdjaGVjayBub3QgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXNzZXJ0LmZhaWwgQCAnc2hvdWxkIGhhdmUgcmV0dXJuZWQgYW4gZXJyb3InXG4gICAgY2F0Y2ggZXJyIDo6XG4gICAgICBpZiAvYW9fZmVuY2Vfb3V0IG5vdCBib3VuZC8udGVzdChlcnIubWVzc2FnZSkgOjpcbiAgICAgICAgLy8gd29ya2VkXG4gICAgICBlbHNlIHRocm93IGVyclxuXG5cbiAgaXQgQCAnY2hlY2sgYWxyZWFkeSBib3VuZCBlcnJvcicsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcblxuICAgIHRyeSA6OlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBjb25zdW1lZDsvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuICBpdCBAICdhbGxvd19tYW55KCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX2ZvcmsoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcblxuICBpdCBAICdhb19ib3VuZCgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19ib3VuZCgpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fcnVuKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBsZXQgcCA9IGYuYW9fcnVuKClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgZXhwZWN0KGYud2hlbl9ydW4pLnRvLmVxdWFsKHApXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZmVuY2VfZ2VuLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4nLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9nZW4gQCBhb19mZW5jZV9pbigpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fZm9sZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfc2luaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19mb2xkKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2l0ZXIsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfc2luaywgYW9fZmVuY2VfaXRlciwgYW9fZHJpdmUsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfcmFjZSwgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2ZlbmNlX2JhcmUnLCBmdW5jdGlvbigpIDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2Vfc2luaygpJywgZnVuY3Rpb24oKSA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGlzX2dlbihzb21lX3F1ZXVlLmdfaW4pXG4gICAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2Vfc2luaygpXG5cbiAgICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgICB2YWx1ZTogJ2ZpcnN0JywgZG9uZTogZmFsc2VcblxuICAgIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuICAgICAgbGV0IHNlY29uZF9xdWV1ZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3F1ZXVlIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc2Vjb25kX3F1ZXVlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICAgIGZpcnN0X3F1ZXVlLmdfaW5cblxuICAgICAgYXdhaXQgZmlyc3RfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2l0ZXIoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fZmVuY2VfaXRlcigpXG5cbiAgICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgICAgbGV0IGZpcnN0X3BpcGUgPSBhb19mZW5jZV9pdGVyKClcbiAgICAgIGxldCBzZWNvbmRfcGlwZSA9IEAhKj5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZpcnN0X3BpcGUgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgICAgc2Vjb25kX3BpcGUuZ19pbiA9IGZpcnN0X3BpcGUuZ19pblxuXG4gICAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc2Vjb25kX3BpcGUsXG4gICAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIHJldHVybiB6XG5cblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyX2ZlbmNlZCwgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fZGVib3VuY2UnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2RlYm91bmNlKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICBleHBlY3QoYW90LndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LndoZW5fcnVuXG5cblxuICBpdCBAICdhb19pdGVyX2ZlbmNlZCB3aXRoIGFvX2ludGVydmFsIGFzIHJhdGUgbGltaXQnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQFxuICAgICAgYW9faXRlcl9mZW5jZWQgQFxuICAgICAgICBbMzAsIDIwLCAxMCwgMTVdXG4gICAgICAgIGFvX2ludGVydmFsKDEwKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGV4cGVjdCh2YWx1ZSkudG8uZXF1YWwoMzApXG5cbiAgICBsZXQgbHN0ID0gW3ZhbHVlXVxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KGxzdCkudG8uZGVlcC5lcXVhbCBAXG4gICAgICBbMzAsIDIwLCAxMCwgMTVdXG5cblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2FuaW1hdGlvbiwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGFuaW1hdGlvbiBmcmFtZXMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9hbmltYXRpb25cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA6OlxuXG4gICAgaXQgQCAnYW9fZG9tX2FuaW1hdGlvbicsIEA6Oj5cbiAgICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9hbmltYXRpb24oKVxuICAgICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodmFsdWUgPj0gMClcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG5cbiAgICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19kb21fYW5pbWF0aW9uKClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fbGlzdGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheSxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgYXJyYXlfZnJvbV9hb19pdGVyXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGV2ZW50cycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2xpc3RlblxuXG4gICAgbGV0IGRlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fbGlzdGVuKClcbiAgICBpc19nZW4gQCBkZS5nX2luXG4gICAgaXNfZm4gQCBkZS53aXRoX2RvbVxuXG5cbiAgaXQgQCAnc2hhcGUgb2Ygd2l0aF9kb20nLCBAOjpcbiAgICBsZXQgbW9jayA9IEB7fVxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihldnQsIGZuLCBvcHQpIDo6XG5cbiAgICBsZXQgZV9jdHggPSBhb19kb21fbGlzdGVuKClcbiAgICAgIC53aXRoX2RvbShtb2NrKVxuXG4gICAgaXNfZm4gQCBlX2N0eC53aXRoX2RvbVxuICAgIGlzX2ZuIEAgZV9jdHgubGlzdGVuXG5cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsIDo6XG5cbiAgICBpdCBAICdtZXNzYWdlIGNoYW5uZWxzJywgQDo6PlxuICAgICAgY29uc3Qge3BvcnQxLCBwb3J0Mn0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKVxuXG4gICAgICBjb25zdCBhb190Z3QgPSBhb19kb21fbGlzdGVuKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFvX3RndClcblxuICAgICAgYW9fdGd0XG4gICAgICAgIC53aXRoX2RvbSBAIHBvcnQyLCB2b2lkIHBvcnQyLnN0YXJ0KClcbiAgICAgICAgLmxpc3RlbiBAICdtZXNzYWdlJywgZXZ0ID0+IEA6IHRlc3RfbmFtZTogZXZ0LmRhdGFcblxuICAgICAgOjohPlxuICAgICAgICBmb3IgbGV0IG0gb2YgWydhJywgJ2InLCAnYyddIDo6XG4gICAgICAgICAgcG9ydDEucG9zdE1lc3NhZ2UgQCBgZnJvbSBtc2cgcG9ydDE6ICR7bX1gXG4gICAgICAgICAgYXdhaXQgZGVsYXkoMSlcblxuICAgICAgICBhb190Z3QuZ19pbi5yZXR1cm4oKVxuICAgICAgICBwb3J0MS5jbG9zZSgpXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGEnXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYidcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztFQUFBLG1DQUFtQyxNQUFNOzs7SUFJdkMsWUFBYTtNQUNYLFdBQVksT0FBUTs7O0lBR3RCLGNBQWU7OztJQUdmO2VBQ1M7TUFDUDtNQUNBOzs7SUFHRixtQkFBbUIsVUFBVTtJQUM3Qjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTs7SUFFQTs7O0lBR0E7SUFDQTtJQUNBOztJQUVBO0lBQ0E7OztJQUdBLE9BQVEsaUNBQWtDO0lBQzFDOzs7SUFHQTtlQUNTO01BQ1A7SUFDRjs7RUNuREYsTUFBTSxVQUFVLEdBQUcsQ0FBQztFQUNwQixFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2xDO0VBQ0EsTUFBTSxR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
