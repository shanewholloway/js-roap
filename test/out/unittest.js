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



  const _ao_fence_core_api_ ={
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


  const ao_fence_obj =
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
        let {xemit, _ao_many} = this;
        this.ao_bound = _ao_many;
        return xemit
          ? _ag_copy(ag_out, xemit(ag_out))
          : ag_out});

      return this}

  , ao_gated(f_gate) {
      return this.bind_gated(f_gate).ao_bound()}

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
  const ao_queue = ns_gen => ao_fence_in().ao_queue(ns_gen);

  const ao_fence_in = ao_fence_v.bind(null,{
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
      let res = xinit(this, f_out, xrecv, _xf_gen);

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



  function * aog_iter(f_in, f_gate, xf, _xf_gen) {
    xf = xf ? _xf_gen.create(xf) : void xf;
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


  async function * aog_sink(f_in, f_gate, xf, _xf_gen) {
    xf = xf ? _xf_gen.create(xf) : void xf;
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

  function ao_fence_iter() {
    let f_in = ao_fence_obj();
    let f_out = ao_fence_out().bind_gated(f_in);
    let g_in = f_out.g_in = aog_iter(f_in);
    g_in.next();
    return f_out}

  function ao_fence_sink() {
    let f_in = ao_fence_obj();
    let f_out = ao_fence_out().bind_gated(f_in);
    let g_in = f_out.g_in = aog_sink(f_in, f_out);
    g_in.next();
    return f_out}

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVyLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb3V0LmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC94Zm9ybS5qc3kiLCIuLi91bml0L2ZvbGQuanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L2ZlbmNlX2JhcmUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2NvcmUoZikgOjpcbiAgaXNfZm4oZi5mZW5jZSlcbiAgaXNfZm4oZi5hb19mb3JrKVxuICBpc19hc3luY19pdGVyYWJsZShmKVxuXG4gIGlzX2ZuKGYuYW9fY2hlY2tfZG9uZSlcbiAgLy8gaXNfZm4oZi5jaGFpbikgLS0gbW92ZWQgdG8gZXhwZXJpbWVudGFsL2NoYWluLm1kXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19mZW5jZV9nZW4oZikgOjpcbiAgaXNfZmVuY2VfY29yZShmKVxuICBpc19mbihmLmFib3J0KVxuICBpc19mbihmLnJlc3VtZSlcblxuICBpc19nZW4oZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IGlzX2FvX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcblxuXG5jb25zdCBhb19kb25lID0gT2JqZWN0LmZyZWV6ZSh7YW9fZG9uZTogdHJ1ZX0pO1xuY29uc3QgYW9fY2hlY2tfZG9uZSA9IGVyciA9PiB7XG4gIGlmIChlcnIgIT09IGFvX2RvbmUgJiYgZXJyICYmICFlcnIuYW9fZG9uZSkge1xuICAgIHRocm93IGVycn1cbiAgcmV0dXJuIHRydWV9O1xuXG5cbmNvbnN0IF9hZ19jb3B5ID0gKHtnX2lufSwgYWdfb3V0KSA9PihcbiAgdW5kZWZpbmVkID09PSBnX2luID8gYWdfb3V0IDooXG4gICAgYWdfb3V0LmdfaW4gPSBnX2luXG4gICwgYWdfb3V0KSApO1xuXG5mdW5jdGlvbiBhb19kZWZlcl9jdHgoYXNfcmVzID0gKC4uLmFyZ3MpID0+IGFyZ3MpIHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBhc19yZXMocCwgeSwgbikpIH1cblxuY29uc3QgYW9fZGVmZXJfdiA9IC8qICNfX1BVUkVfXyAqLyBhb19kZWZlcl9jdHgoKTtcblxuY29uc3QgYW9fZGVmZXIgPSAvKiAjX19QVVJFX18gKi9cbiAgYW9fZGVmZXJfY3R4KChwLHksbikgPT5cbiAgICAoe3Byb21pc2U6IHAsIHJlc29sdmU6IHksIHJlamVjdDogbn0pKTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoaXRlcmFibGUpIHtcbiAgcmV0dXJuICh5aWVsZCAqIGl0ZXJhYmxlKX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb19pdGVyX2ZlbmNlZChpdGVyYWJsZSwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgIGF3YWl0IGY7XG4gICAgeWllbGQgdjtcbiAgICBmID0gZl9nYXRlLmZlbmNlKCk7fSB9XG5cblxuY29uc3QgYW9faXRlcl9mZW5jZWQgPSAoLi4uYXJncykgPT5cbiAgX2FnX2NvcHkoYXJnc1swXSwgX2FvX2l0ZXJfZmVuY2VkKC4uLmFyZ3MpKTtcblxuZnVuY3Rpb24gYW9fZmVuY2Vfdihwcm90bykge1xuICBsZXQgcmVzZXQgPSBhb19kZWZlcl9jdHgoKSwgeD1yZXNldCgpLCBwPTA7XG5cbiAgbGV0IGZlbmNlICA9ICgpID0+KDAgIT09IHAgPyBwIDogcD0oeD1yZXNldCgpKVswXSk7XG4gIGxldCByZXN1bWUgPSBhbnMgPT4ge3A9MDsgeFsxXShhbnMpO307XG4gIGxldCBhYm9ydCAgPSBlcnIgPT4ge3A9MDsgeFsyXShlcnIpO307XG5cbiAgcmV0dXJuIHByb3RvXG4gICAgP3tfX3Byb3RvX186IHByb3RvLCBmZW5jZSwgcmVzdW1lLCBhYm9ydH1cbiAgICA6W2ZlbmNlLCByZXN1bWUsIGFib3J0XSB9XG5cblxuXG5jb25zdCBfYW9fZmVuY2VfY29yZV9hcGlfID17XG4gIGFvX2NoZWNrX2RvbmVcblxuLCAvLyBjb3B5YWJsZSBmZW5jZSBmb3JrIGFwaVxuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmFvX2ZvcmsoKX1cblxuLCBhb19mb3JrKCkge1xuICAgIGxldCBhZyA9IHRoaXMuX2FvX2ZvcmsoKTtcbiAgICBsZXQge3hlbWl0fSA9IHRoaXM7XG4gICAgcmV0dXJuIHhlbWl0ID8geGVtaXQoYWcpIDogYWd9XG5cbiwgYXN5bmMgKiBfYW9fZm9yaygpIHtcbiAgICBsZXQge2ZlbmNlfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIGxldCByID0gYXdhaXQgZmVuY2UoKTtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gcikge1xuICAgICAgICAgIHlpZWxkIHI7fSB9IH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fSB9IH07XG5cblxuZnVuY3Rpb24gYW9fZmVuY2VfZm4odGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfdigpO1xuICBpZiAodW5kZWZpbmVkID09PSB0Z3QpIHt0Z3QgPSBmWzBdO31cbiAgdGd0LmZlbmNlID0gT2JqZWN0LmFzc2lnbih0Z3QsIF9hb19mZW5jZV9jb3JlX2FwaV8pO1xuICByZXR1cm4gZn1cblxuXG5jb25zdCBhb19mZW5jZV9vYmogPVxuICBhb19mZW5jZV92LmJpbmQobnVsbCwgX2FvX2ZlbmNlX2NvcmVfYXBpXyk7XG5cbmZ1bmN0aW9uIGFvX3NwbGl0KGl0ZXJhYmxlKSB7XG4gIGxldCBmX291dCA9IGFvX2ZlbmNlX29iaigpO1xuICBmX291dC53aGVuX3J1biA9IF9hb19ydW4oaXRlcmFibGUsIGZfb3V0KTtcbiAgZl9vdXQuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBmX291dH1cblxuYXN5bmMgZnVuY3Rpb24gX2FvX3J1bihpdGVyYWJsZSwgZl90YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBmX3RhcC5yZXN1bWUodik7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG5cbiAgZmluYWxseSB7XG4gICAgZl90YXAuYWJvcnQoKTt9IH1cblxuXG5mdW5jdGlvbiBhb190YXAoaXRlcmFibGUpIHtcbiAgbGV0IGZfdGFwID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBhZ190YXAgPSBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCk7XG4gIGFnX3RhcC5mX3RhcCA9IGFnX3RhcC5mX291dCA9IGZfdGFwO1xuICBhZ190YXAuZ19pbiA9IGZfdGFwLmdfaW4gPSBpdGVyYWJsZS5nX2luO1xuICByZXR1cm4gW2ZfdGFwLCBhZ190YXBdfVxuXG5hc3luYyBmdW5jdGlvbiAqIF9hb190YXAoaXRlcmFibGUsIGZfdGFwKSB7XG4gIHRyeSB7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBpdGVyYWJsZSkge1xuICAgICAgZl90YXAucmVzdW1lKHYpO1xuICAgICAgeWllbGQgdjt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBmX3RhcC5hYm9ydCgpO30gfVxuXG5jb25zdCBhb19mZW5jZV9vdXQgPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG4sIF9hb19tYW55KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGNvbnN1bWVkOyBjb25zaWRlciAuYW9fZm9yaygpIG9yIC5hbGxvd19tYW55KCknKX1cblxuLCBhbGxvd19tYW55KCkge1xuICAgIGxldCB7YW9fZm9yaywgYW9fYm91bmQsIF9hb19tYW55fSA9IHRoaXM7XG4gICAgaWYgKF9hb19tYW55ID09PSBhb19ib3VuZCkge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IGFvX2Zvcms7fVxuICAgIHRoaXMuX2FvX21hbnkgPSBhb19mb3JrO1xuICAgIHRoaXMuYWxsb3dfbWFueSA9ICgpID0+IHRoaXM7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMuYW9fYm91bmQoKSk7IH1cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgbGV0IHt4ZW1pdCwgX2FvX21hbnl9ID0gdGhpcztcbiAgICAgIHRoaXMuYW9fYm91bmQgPSBfYW9fbWFueTtcbiAgICAgIHJldHVybiB4ZW1pdFxuICAgICAgICA/IF9hZ19jb3B5KGFnX291dCwgeGVtaXQoYWdfb3V0KSlcbiAgICAgICAgOiBhZ19vdXR9KTtcblxuICAgIHJldHVybiB0aGlzfVxuXG4sIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHJldHVybiB0aGlzLmJpbmRfZ2F0ZWQoZl9nYXRlKS5hb19ib3VuZCgpfVxuXG4sIGFzeW5jICogX2FvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLnJlc3VtZSgpO1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgbGV0IHYgPSBhd2FpdCBmX2dhdGUuZmVuY2UoKTtcbiAgICAgICAgeWllbGQgdjtcbiAgICAgICAgdGhpcy5yZXN1bWUodik7fSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgICBmaW5hbGx5IHtcbiAgICAgIHRoaXMuYWJvcnQoKTtcbiAgICAgIGlmIChmX2dhdGUuYWJvcnQpIHtcbiAgICAgICAgZl9nYXRlLmFib3J0KCk7fSB9IH0gfSApO1xuXG5jb25zdCBhb194Zm9ybSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3hmb3JtKG5zX2dlbik7XG5jb25zdCBhb19mb2xkID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fZm9sZChuc19nZW4pO1xuY29uc3QgYW9fcXVldWUgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZShuc19nZW4pO1xuXG5jb25zdCBhb19mZW5jZV9pbiA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfY29yZV9hcGlfXG5cbiwgYW9fZm9sZChuc19nZW4pIHtyZXR1cm4gdGhpcy5hb194Zm9ybSh7eGluaXQ6IGFvZ19pdGVyLCAuLi4gbnNfZ2VufSl9XG4sIGFvX3F1ZXVlKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KX1cblxuLCBhb2dfaXRlcih4Zikge3JldHVybiBhb2dfaXRlcih0aGlzKX1cbiwgYW9nX3NpbmsoZl9nYXRlLCB4Zikge3JldHVybiBhb2dfc2luayh0aGlzLCBmX2dhdGUsIHhmKX1cblxuLCBhb194Zm9ybShuc19nZW49e30pIHtcbiAgICBsZXQgZl9vdXQgPSBhb19mZW5jZV9vdXQoKTtcblxuICAgIGxldCB7eGVtaXQsIHhpbml0LCB4cmVjdn0gPVxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4ZW1pdCkge1xuICAgICAgZl9vdXQueGVtaXQgPSB4ZW1pdDt9XG5cbiAgICBpZiAoISB4aW5pdCkge3hpbml0ID0gYW9nX3Npbms7fVxuICAgIGxldCByZXMgPSB4aW5pdCh0aGlzLCBmX291dCwgeHJlY3YsIF94Zl9nZW4pO1xuXG4gICAgbGV0IGFnX291dCwgZ19pbiA9IHJlcy5nX2luIHx8IHJlcztcbiAgICBpZiAocmVzID09PSBnX2luKSB7XG4gICAgICAvLyByZXMgaXMgYW4gaW5wdXQgZ2VuZXJhdG9yXG4gICAgICBnX2luLm5leHQoKTtcbiAgICAgIGFnX291dCA9IGZfb3V0LmJpbmRfZ2F0ZWQodGhpcyk7fVxuXG4gICAgZWxzZSB7XG4gICAgICAvLyByZXMgaXMgYW4gb3V0cHV0IGdlbmVyYXRvclxuICAgICAgYWdfb3V0ID0gcmVzO31cblxuICAgIGFnX291dC5nX2luID0gZl9vdXQuZ19pbiA9IGdfaW47XG4gICAgcmV0dXJuIGFnX291dH1cblxuXG4sIC8vIEVTMjAxNSBnZW5lcmF0b3IgYXBpXG4gIG5leHQodikge3JldHVybiB7dmFsdWU6IHRoaXMucmVzdW1lKHYpLCBkb25lOiB0cnVlfX1cbiwgcmV0dXJuKCkge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoYW9fZG9uZSksIGRvbmU6IHRydWV9fVxuLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fSB9ICk7XG5cblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGZfaW4sIGZfZ2F0ZSwgeGYsIF94Zl9nZW4pIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9ICh4Zi5uZXh0KHRpcCkpLnZhbHVlO31cbiAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGZfaW4uYWJvcnQoKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGZfaW4sIGZfZ2F0ZSwgeGYsIF94Zl9nZW4pIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgICB7XG4gICAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgICB0aXAgPSAoYXdhaXQgeGYubmV4dCh0aXApKS52YWx1ZTt9XG4gICAgICAgIGZfaW4ucmVzdW1lKHRpcCk7fVxuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBmX2dhdGUpIHtcbiAgICAgICAgYXdhaXQgZl9nYXRlLmZlbmNlKCk7fSB9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZl9pbi5hYm9ydCgpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmNvbnN0IF94Zl9nZW4gPXtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmNvbnN0IGFvX2ZlZWRlciA9IFxuICAoe2dfaW59KSA9PiB2ID0+IGdfaW4ubmV4dCh2KTtcblxuY29uc3QgYW9fZmVlZGVyX3YgPSBcbiAgKHtnX2lufSkgPT4gKC4uLmFyZ3MpID0+IGdfaW4ubmV4dChhcmdzKTtcblxuZnVuY3Rpb24gYW9fZmVuY2VfaXRlcigpIHtcbiAgbGV0IGZfaW4gPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGZfb3V0ID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2luKTtcbiAgbGV0IGdfaW4gPSBmX291dC5nX2luID0gYW9nX2l0ZXIoZl9pbik7XG4gIGdfaW4ubmV4dCgpO1xuICByZXR1cm4gZl9vdXR9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3NpbmsoKSB7XG4gIGxldCBmX2luID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9pbik7XG4gIGxldCBnX2luID0gZl9vdXQuZ19pbiA9IGFvZ19zaW5rKGZfaW4sIGZfb3V0KTtcbiAgZ19pbi5uZXh0KCk7XG4gIHJldHVybiBmX291dH1cblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBhb19pdGVyYWJsZSkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLndoZW5fcnVuID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgICAgcCA9IF9mZW5jZSgpO1xuICAgICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCB2KTt9XG5cbiAgICAgIGF3YWl0IHA7fVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhhb19pdGVyYWJsZSkge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBhb19pdGVyYWJsZSkge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiByYWZcblxuICBmdW5jdGlvbiByYWYoKSB7XG4gICAgdGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKF9yZXN1bWUpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBfZXZ0X2luaXQgPSBQcm9taXNlLnJlc29sdmUoe3R5cGU6J2luaXQnfSk7XG5mdW5jdGlvbiBhb19kb21fbGlzdGVuKHNlbGY9YW9fcXVldWUoKSkge1xuICByZXR1cm4gX2JpbmQuc2VsZiA9IHNlbGYgPXtcbiAgICBfX3Byb3RvX186IHNlbGZcbiAgLCB3aXRoX2RvbShkb20sIGZuKSB7XG4gICAgICByZXR1cm4gZG9tLmFkZEV2ZW50TGlzdGVuZXJcbiAgICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSl9IH1cblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgc2VsZi5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYWdfY29weSwgX2FvX2ZlbmNlX2NvcmVfYXBpXywgX2FvX2l0ZXJfZmVuY2VkLCBfYW9fcnVuLCBfYW9fdGFwLCBfeGZfZ2VuLCBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXIsIGFvX2RlZmVyX2N0eCwgYW9fZGVmZXJfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZG9uZSwgYW9fZHJpdmUsIGFvX2ZlZWRlciwgYW9fZmVlZGVyX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9pbiwgYW9fZmVuY2VfaXRlciwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9vdXQsIGFvX2ZlbmNlX3NpbmssIGFvX2ZlbmNlX3YsIGFvX2ZvbGQsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlZCwgYW9fcXVldWUsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9feGZvcm0sIGFvZ19pdGVyLCBhb2dfc2luaywgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlciwgYW9fZGVmZXJfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcicsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJcbiAgICBpc19mbiBAIGFvX2RlZmVyX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfaW5cblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4iLCJpbXBvcnQge2FvX2RlZmVyLCBhb19kZWZlcl92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19kZWZlcicsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVyX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcl92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXIgb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5wcm9taXNlKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMucmVzb2x2ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZWplY3QpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVyKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4oZylcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBpdCBAICdhb19zcGxpdCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3Mud2hlbl9ydW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgaXQgQCAnYW9fdGFwIHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgW2Zfb3V0LCBhZ190YXBdID0gYW9fdGFwKGcpXG4gICAgICBpc19hc3luY19pdGVyYWJsZSBAIGZfb3V0XG4gICAgICBpc19nZW4gQCBhZ190YXBcblxuICAgICAgZXhwZWN0KGZfb3V0LmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZl9vdXQuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dClcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFnX3RhcClcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBkZWxheV9yYWNlfSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICBsZXQgZlxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3R3bycsIGF3YWl0IGZcblxuICAgIHJlc3VtZSBAICdmb3VyJ1xuICAgIHJlc3VtZSBAICdmaXZlJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3NpeCdcbiAgICByZXN1bWUgQCAnc2V2ZW4nXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAnc2l4JywgYXdhaXQgZlxuXG5cbiAgaXQgQCAnbmV2ZXIgYmxvY2tlZCBvbiBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cblxuICBpdCBAICdleGVyY2lzZSBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGxldCB2ID0gJ2EnXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdhJylcblxuICAgIGNvbnN0IHAgPSBAIT5cbiAgICAgIHYgPSAnYidcblxuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2JiJylcblxuICAgICAgdiA9ICdjJ1xuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2NjJylcbiAgICAgIHYgPSAnZCdcbiAgICAgIHJldHVybiAxOTQyXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdkJylcblxuIiwiaW1wb3J0IHthb19mZW5jZV9mbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LCBcbiAgaXNfZmVuY2VfY29yZSxcbiAgZGVsYXlfcmFjZSwgZGVsYXlcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2ZuJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXNfZmVuY2VfY29yZShyZXNbMF0pXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IGZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsIFxuICBpc19mZW5jZV9jb3JlLFxuICBkZWxheV9yYWNlLCBkZWxheSxcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX29iaicsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mZW5jZV9jb3JlIEAgYW9fZmVuY2Vfb2JqKClcblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9vdXQsIGFvX2l0ZXIsIGFvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLFxuICBpc19mZW5jZV9jb3JlLFxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb3V0JywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGlzX2ZlbmNlX2NvcmUgQCBhb19mZW5jZV9vdXQoKVxuICAgIGV4cGVjdChyZXMuYW9fYm91bmQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX3J1bikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYmluZF9nYXRlZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYWxsb3dfbWFueSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnY2hlY2sgbm90IGJvdW5kIGVycm9yJywgQDo6PlxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKVxuXG4gICAgdHJ5IDo6XG4gICAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICAgIGFzc2VydC5mYWlsIEAgJ3Nob3VsZCBoYXZlIHJldHVybmVkIGFuIGVycm9yJ1xuICAgIGNhdGNoIGVyciA6OlxuICAgICAgaWYgL2FvX2ZlbmNlX291dCBub3QgYm91bmQvLnRlc3QoZXJyLm1lc3NhZ2UpIDo6XG4gICAgICAgIC8vIHdvcmtlZFxuICAgICAgZWxzZSB0aHJvdyBlcnJcblxuXG4gIGl0IEAgJ2NoZWNrIGFscmVhZHkgYm91bmQgZXJyb3InLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG5cbiAgICB0cnkgOjpcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYpLm5leHQoKVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZikubmV4dCgpXG4gICAgICBhc3NlcnQuZmFpbCBAICdzaG91bGQgaGF2ZSByZXR1cm5lZCBhbiBlcnJvcidcbiAgICBjYXRjaCBlcnIgOjpcbiAgICAgIGlmIC9hb19mZW5jZV9vdXQgY29uc3VtZWQ7Ly50ZXN0KGVyci5tZXNzYWdlKSA6OlxuICAgICAgICAvLyB3b3JrZWRcbiAgICAgIGVsc2UgdGhyb3cgZXJyXG5cbiAgaXQgQCAnYWxsb3dfbWFueSgpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcblxuICBpdCBAICdhb19mb3JrKCknLCBAOjo+XG4gICAgY29uc3QgZl9nYXRlID0gYW9fZmVuY2Vfb2JqKClcbiAgICBjb25zdCBmID0gYW9fZmVuY2Vfb3V0KCkuYmluZF9nYXRlZChmX2dhdGUpXG4gICAgZi5hbGxvd19tYW55KClcblxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fZm9yaygpKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmKS5uZXh0KClcbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG5cbiAgaXQgQCAnYW9fYm91bmQoKScsIEA6Oj5cbiAgICBjb25zdCBmX2dhdGUgPSBhb19mZW5jZV9vYmooKVxuICAgIGNvbnN0IGYgPSBhb19mZW5jZV9vdXQoKS5iaW5kX2dhdGVkKGZfZ2F0ZSlcbiAgICBmLmFsbG93X21hbnkoKVxuXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuICAgIGF3YWl0IGRlbGF5X3JhY2UgQCBhb19pdGVyKGYuYW9fYm91bmQoKSkubmV4dCgpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuXG4gIGl0IEAgJ2FvX3J1bigpJywgQDo6PlxuICAgIGNvbnN0IGZfZ2F0ZSA9IGFvX2ZlbmNlX29iaigpXG4gICAgY29uc3QgZiA9IGFvX2ZlbmNlX291dCgpLmJpbmRfZ2F0ZWQoZl9nYXRlKVxuICAgIGYuYWxsb3dfbWFueSgpXG5cbiAgICBhd2FpdCBkZWxheV9yYWNlIEAgYW9faXRlcihmLmFvX2ZvcmsoKSkubmV4dCgpXG4gICAgbGV0IHAgPSBmLmFvX3J1bigpXG4gICAgYXdhaXQgZGVsYXlfcmFjZSBAIGFvX2l0ZXIoZi5hb19mb3JrKCkpLm5leHQoKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgIGV4cGVjdChmLndoZW5fcnVuKS50by5lcXVhbChwKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2lufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtcbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2ZlbmNlX2dlbixcbiAgZGVsYXlfcmFjZSwgZGVsYXlcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfZ2VuIEAgYW9fZmVuY2VfaW4oKVxuICAgIGV4cGVjdChyZXMuYW9feGZvcm0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX2ZvbGQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX3F1ZXVlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfaXRlcikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9nX3NpbmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzLnJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9feGZvcm0oKScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9waXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0oKVxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4cmVjdiBzdW0gcHJlIHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSBAOlxuICAgICAgKnhyZWN2KGcpIDo6XG4gICAgICAgIGxldCBzID0gMFxuICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHMgKz0gdlxuICAgICAgICAgIHlpZWxkIHNcblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDE5NDIrMjA0MiwgMTk0MisyMDQyKzIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4ZW1pdCBwb3N0IHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeGluaXQoZ19pbikgOjpcbiAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBzdGFydCdcbiAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICB0cnkgOjpcbiAgICAgICAgICB5aWVsZCAqIGdfaW4uYW9nX2l0ZXIoKVxuICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgc29tZV9waXBlLmdfaW4ucmV0dXJuKClcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgcmV0dXJuIHpcblxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9fZm9sZCgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX2ZvbGQoKVxuXG4gICAgaXNfZ2VuIEAgc29tZV9waXBlLmdfaW5cbiAgICBleHBlY3Qoc29tZV9waXBlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2ltcGxlJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQoKVxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4cmVjdiBzdW0gcHJlIHRyYW5zZm9ybScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgIGFzeW5jICogeGVtaXQoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hpbml0IGNvbnRleHQgZ19pbicsIEA6Oj5cbiAgICBsZXQgbG9nPVtdXG5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19mb2xkIEA6XG4gICAgICAqeGluaXQoZ19pbikgOjpcbiAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBzdGFydCdcbiAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICB0cnkgOjpcbiAgICAgICAgICB5aWVsZCAqIGdfaW4uYW9nX2l0ZXIoKVxuICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgc29tZV9waXBlLmdfaW4ucmV0dXJuKClcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgYXN5bmMgZnVuY3Rpb24gX3Rlc3RfcGlwZV9vdXQoc29tZV9waXBlLCB2YWx1ZXMpIDo6XG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgcmV0dXJuIHpcblxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19pdGVyLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luKCkuYW9fcXVldWUoKScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgaXNfZ2VuKHNvbWVfcXVldWUuZ19pbilcbiAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKClcblxuICAgIGxldCBwX291dDEgPSBhb19pdGVyKHNvbWVfcXVldWUpLm5leHQoKVxuICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfaW4xID0gc29tZV9xdWV1ZS5nX2luLm5leHQgQCAnZmlyc3QnXG4gICAgZXhwZWN0KHBfaW4xKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGV4cGVjdChhd2FpdCBwX291dDEpLnRvLmRlZXAuZXF1YWwgQDpcbiAgICAgIHZhbHVlOiAnZmlyc3QnLCBkb25lOiBmYWxzZVxuXG4gIGl0IEAgJ3ZlYycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUgQDpcbiAgICAgIGFzeW5jICogeHJlY3YoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCAxMDAwK3ZcblxuICAgIGxldCBvdXQgPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9xdWV1ZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICBzb21lX3F1ZXVlLmdfaW5cblxuICAgIGF3YWl0IHNvbWVfcXVldWUuZ19pbi5yZXR1cm4oKVxuXG4gICAgZXhwZWN0KGF3YWl0IG91dCkudG8uZGVlcC5lcXVhbCBAI1xuICAgICAgMTAyNSwgMTA1MCwgMTA3NSwgMTEwMFxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3NpbmssIGFvX2ZlbmNlX2l0ZXIsIGFvX2RyaXZlLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGRlbGF5X3JhY2UsIGRlbGF5X3dhbGssIGFycmF5X2Zyb21fYW9faXRlcixcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdmZW5jZV9iYXJlJywgZnVuY3Rpb24oKSA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX3NpbmsoKScsIGZ1bmN0aW9uKCkgOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgbGV0IHNvbWVfcXVldWUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX2ZlbmNlX3NpbmsoKVxuXG4gICAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgICAgZXhwZWN0KHNvbWVfcXVldWUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX3NpbmsoKVxuXG4gICAgICBsZXQgcF9vdXQxID0gYW9faXRlcihzb21lX3F1ZXVlKS5uZXh0KClcbiAgICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICAgIGV4cGVjdChwX2luMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChhd2FpdCBwX291dDEpLnRvLmRlZXAuZXF1YWwgQDpcbiAgICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgICBsZXQgZmlyc3RfcXVldWUgPSBhb19mZW5jZV9zaW5rKClcbiAgICAgIGxldCBzZWNvbmRfcXVldWUgPSBAISo+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmaXJzdF9xdWV1ZSA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNlY29uZF9xdWV1ZSlcblxuICAgICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMFxuICAgICAgICBmaXJzdF9xdWV1ZS5nX2luXG5cbiAgICAgIGF3YWl0IGZpcnN0X3F1ZXVlLmdfaW4ucmV0dXJuKClcblxuICAgICAgZXhwZWN0KGF3YWl0IG91dCkudG8uZGVlcC5lcXVhbCBAI1xuICAgICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cblxuICBkZXNjcmliZSBAICdhb19mZW5jZV9pdGVyKCknLCBmdW5jdGlvbigpIDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX2ZlbmNlX2l0ZXIoKVxuXG4gICAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAnc2ltcGxlJywgQDo6PlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2l0ZXIoKVxuICAgICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgICBpdCBAICd4ZW1pdCBwb3N0IHRyYW5zZm9ybScsIEA6Oj5cbiAgICAgIGxldCBmaXJzdF9waXBlID0gYW9fZmVuY2VfaXRlcigpXG4gICAgICBsZXQgc2Vjb25kX3BpcGUgPSBAISo+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmaXJzdF9waXBlIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICAgIHNlY29uZF9waXBlLmdfaW4gPSBmaXJzdF9waXBlLmdfaW5cblxuICAgICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNlY29uZF9waXBlLFxuICAgICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uIF90ZXN0X3BpcGVfb3V0KHNvbWVfcGlwZSwgdmFsdWVzKSA6OlxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9faW50ZXJ2YWwsIGFvX3RpbWVvdXQsIGFvX2RlYm91bmNlLCBhb190aW1lcywgYW9faXRlcl9mZW5jZWQsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAndGltZScsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9faW50ZXJ2YWxcbiAgICBpc19mbiBAIGFvX3RpbWVvdXRcbiAgICBpc19mbiBAIGFvX3RpbWVzXG5cblxuICBpdCBAICdhb19pbnRlcnZhbCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9faW50ZXJ2YWwoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX3RpbWVvdXQnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX3RpbWVvdXQoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX2RlYm91bmNlJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19kZWJvdW5jZSgxMCwgWzMwLCAyMCwgMTAsIDE1XSlcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgZXhwZWN0KGFvdC53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgYXNzZXJ0LmVxdWFsKDE1LCB2YWx1ZSlcblxuICAgIGF3YWl0IGFvdC53aGVuX3J1blxuXG5cbiAgaXQgQCAnYW9faXRlcl9mZW5jZWQgd2l0aCBhb19pbnRlcnZhbCBhcyByYXRlIGxpbWl0JywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEBcbiAgICAgIGFvX2l0ZXJfZmVuY2VkIEBcbiAgICAgICAgWzMwLCAyMCwgMTAsIDE1XVxuICAgICAgICBhb19pbnRlcnZhbCgxMClcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBleHBlY3QodmFsdWUpLnRvLmVxdWFsKDMwKVxuXG4gICAgbGV0IGxzdCA9IFt2YWx1ZV1cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgbHN0LnB1c2godilcblxuICAgIGV4cGVjdChsc3QpLnRvLmRlZXAuZXF1YWwgQFxuICAgICAgWzMwLCAyMCwgMTAsIDE1XVxuXG5cbiAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2ludGVydmFsKDEwKVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9hbmltYXRpb24sIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBhbmltYXRpb24gZnJhbWVzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fYW5pbWF0aW9uXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgOjpcblxuICAgIGl0IEAgJ2FvX2RvbV9hbmltYXRpb24nLCBAOjo+XG4gICAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fYW5pbWF0aW9uKClcbiAgICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHZhbHVlID49IDApXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuXG4gICAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9fZG9tX2FuaW1hdGlvbigpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2xpc3Rlbn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXksXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGFycmF5X2Zyb21fYW9faXRlclxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBldmVudHMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9saXN0ZW5cblxuICAgIGxldCBkZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2xpc3RlbigpXG4gICAgaXNfZ2VuIEAgZGUuZ19pblxuICAgIGlzX2ZuIEAgZGUud2l0aF9kb21cblxuXG4gIGl0IEAgJ3NoYXBlIG9mIHdpdGhfZG9tJywgQDo6XG4gICAgbGV0IG1vY2sgPSBAe31cbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZ0LCBmbiwgb3B0KSA6OlxuXG4gICAgbGV0IGVfY3R4ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICAud2l0aF9kb20obW9jaylcblxuICAgIGlzX2ZuIEAgZV9jdHgud2l0aF9kb21cbiAgICBpc19mbiBAIGVfY3R4Lmxpc3RlblxuXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA6OlxuXG4gICAgaXQgQCAnbWVzc2FnZSBjaGFubmVscycsIEA6Oj5cbiAgICAgIGNvbnN0IHtwb3J0MSwgcG9ydDJ9ID0gbmV3IE1lc3NhZ2VDaGFubmVsKClcblxuICAgICAgY29uc3QgYW9fdGd0ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihhb190Z3QpXG5cbiAgICAgIGFvX3RndFxuICAgICAgICAud2l0aF9kb20gQCBwb3J0Miwgdm9pZCBwb3J0Mi5zdGFydCgpXG4gICAgICAgIC5saXN0ZW4gQCAnbWVzc2FnZScsIGV2dCA9PiBAOiB0ZXN0X25hbWU6IGV2dC5kYXRhXG5cbiAgICAgIDo6IT5cbiAgICAgICAgZm9yIGxldCBtIG9mIFsnYScsICdiJywgJ2MnXSA6OlxuICAgICAgICAgIHBvcnQxLnBvc3RNZXNzYWdlIEAgYGZyb20gbXNnIHBvcnQxOiAke219YFxuICAgICAgICAgIGF3YWl0IGRlbGF5KDEpXG5cbiAgICAgICAgYW9fdGd0LmdfaW4ucmV0dXJuKClcbiAgICAgICAgcG9ydDEuY2xvc2UoKVxuXG4gICAgICBsZXQgZXhwZWN0ZWQgPSBAW11cbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBhJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGInXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYydcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwoZXhwZWN0ZWQpXG5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7RUFBQSxtQ0FBbUMsTUFBTTs7O0lBSXZDLFlBQWE7TUFDWCxXQUFZLE9BQVE7OztJQUd0QixjQUFlOzs7SUFHZjtlQUNTO01BQ1A7TUFDQTs7O0lBR0YsbUJBQW1CLFVBQVU7SUFDN0I7OztJQUdBO0lBQ0E7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7O0lBRUE7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBOzs7SUFHQSxPQUFRLGlDQUFrQztJQUMxQzs7O0lBR0E7ZUFDUztNQUNQO0lBQ0Y7O0VDbkRGLE1BQU0sVUFBVSxHQUFHLENBQUM7RUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztFQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7RUFDckIsRUFBRSxVQUFVLEtBQUssT0FBTyxJQUFJO0VBQzVCLE9BQU8sRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFD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
