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
    is_fn(f.chain);
    return f}

  function is_fence_gen(f) {
    is_fence_core(f);
    is_fn(f.abort);
    is_fn(f.resume);

    is_fn(f.next);
    is_fn(f.return);
    is_fn(f.throw);
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

  const _ao_out_multiple = (() => {
    throw new Error('ao_fence_out already consumed')});

  const ao_fence_out = ao_fence_v.bind(null,{
    __proto__: _ao_fence_core_api_

  , [Symbol.asyncIterator]() {return this.ao_bound()}
  , ao_bound() {
      throw new Error('ao_fence_out not bound')}

  , ao_run() {
      let {when_run} = this;
      if (undefined === when_run) {
        this.when_run = when_run =
          ao_run(this);}
      return when_run}

  , bind_gated(f_gate) {
      let ag_out = this._ao_gated(f_gate);
      ag_out.f_out = this;
      ag_out.g_in = this.g_in;
      this.ao_bound = (() => {
        this.ao_bound = _ao_out_multiple;
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
        f_gate.abort();
        this.abort();} } } );
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

  describe('smoke', (() => {
    it('deferred', (() => {
      is_fn(ao_deferred);
      is_fn(ao_deferred_v); }) );

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

  describe('core ao_deferred', (() => {

    describe('ao_deferred_v tuple', (() => {
      it('shape', (() => {
        const res = ao_deferred_v();
        expect(res).to.be.an('array').of.length(3);
        expect(res[0]).to.be.a('promise');
        expect(res[1]).to.be.a('function');
        expect(res[2]).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const [p, resolve, reject] = ao_deferred_v();

        assert.equal('timeout', await delay_race(p,1));

        resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const [p, resolve, reject] = ao_deferred_v();

        assert.equal('timeout', await delay_race(p,1));

        reject(new Error('nope'));

        try {
          await p;
          assert.fail();}
        catch (err) {
          assert.equal('nope', err.message); } }) ); }) );



    describe('ao_deferred object', (() => {
      it('shape', (() => {
        const res = ao_deferred();
        expect(res).to.be.an('object');
        expect(res.promise).to.be.a('promise');
        expect(res.resolve).to.be.a('function');
        expect(res.reject).to.be.a('function');}) );

      it('use, resolve', (async () => {
        const res = ao_deferred();
        let p = res.promise;

        assert.equal('timeout', await delay_race(p,1));

        res.resolve('yup');
        assert.equal('yup', await delay_race(p,1)); }) );

      it('use, reject', (async () => {
        const res = ao_deferred();
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
        let z = array_from_ao_iter(ag_tap);

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
      is_fence_gen(ao_fence_obj()); }) );

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
      expect(res.bind_gated).to.be.a('function');}) ); } );

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

      expect(aot.fin).to.be.a('promise');

      let p = g.next();
      expect(p).to.be.a('promise');

      let {value} = await p;
      assert.equal(15, value);

      await aot.fin;}) );


    it('ao_interval as rate limit', (async () => {
      let g = is_gen(
        ao_interval(10, [30, 20, 10, 15]));

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

          ao_tgt.g_in.return();})();}

        let expected =[
          {test_name: 'from msg port1: a'}
        , {test_name: 'from msg port1: b'}
        , {test_name: 'from msg port1: c'} ];

        expect(await z).to.deep.equal(expected);}) ); } }) );

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVycmVkLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC94Zm9ybS5qc3kiLCIuLi91bml0L2ZvbGQuanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L3RpbWUuanN5IiwiLi4vdW5pdC9kb21fYW5pbS5qc3kiLCIuLi91bml0L2RvbV9saXN0ZW4uanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgYXNzZXJ0LCBleHBlY3QgfSA9IHJlcXVpcmUoJ2NoYWknKVxuZXhwb3J0IEB7fSBhc3NlcnQsIGV4cGVjdFxuXG5leHBvcnQgY29uc3QgZGVsYXkgPSAobXM9MSkgPT4gXG4gIG5ldyBQcm9taXNlIEAgeSA9PlxuICAgIHNldFRpbWVvdXQgQCB5LCBtcywgJ3RpbWVvdXQnXG5cbmV4cG9ydCBjb25zdCBkZWxheV9yYWNlID0gKHAsIG1zPTEpID0+IFxuICBQcm9taXNlLnJhY2UgQCMgcCwgZGVsYXkobXMpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGRlbGF5X3dhbGsoZ19pbiwgbXM9MSkgOjpcbiAgYXdhaXQgZGVsYXkobXMpXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnX2luIDo6XG4gICAgeWllbGQgdlxuICAgIGF3YWl0IGRlbGF5KG1zKVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZm4oZm4pIDo6XG4gIGV4cGVjdChmbikudG8uYmUuYSgnZnVuY3Rpb24nKVxuICByZXR1cm4gZm5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2dlbihnKSA6OlxuICBpc19mbihnLm5leHQpXG4gIGlzX2ZuKGcucmV0dXJuKVxuICBpc19mbihnLnRocm93KVxuICByZXR1cm4gZ1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmVuY2VfY29yZShmKSA6OlxuICBpc19mbihmLmZlbmNlKVxuICBpc19mbihmLmFvX2ZvcmspXG4gIGlzX2FzeW5jX2l0ZXJhYmxlKGYpXG5cbiAgaXNfZm4oZi5hb19jaGVja19kb25lKVxuICBpc19mbihmLmNoYWluKVxuICByZXR1cm4gZlxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZmVuY2VfZ2VuKGYpIDo6XG4gIGlzX2ZlbmNlX2NvcmUoZilcbiAgaXNfZm4oZi5hYm9ydClcbiAgaXNfZm4oZi5yZXN1bWUpXG5cbiAgaXNfZm4oZi5uZXh0KVxuICBpc19mbihmLnJldHVybilcbiAgaXNfZm4oZi50aHJvdylcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IGlzX2FvX2ZuID0gdl9mbiA9PlxuICAnZnVuY3Rpb24nID09PSB0eXBlb2Ygdl9mblxuICAgICYmICEgaXNfYW9faXRlcih2X2ZuKTtcblxuXG5jb25zdCBhb19kb25lID0gT2JqZWN0LmZyZWV6ZSh7YW9fZG9uZTogdHJ1ZX0pO1xuY29uc3QgYW9fY2hlY2tfZG9uZSA9IGVyciA9PiB7XG4gIGlmIChlcnIgIT09IGFvX2RvbmUgJiYgZXJyICYmICFlcnIuYW9fZG9uZSkge1xuICAgIHRocm93IGVycn1cbiAgcmV0dXJuIHRydWV9O1xuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwpIHtcbiAgY2hhaW4udGFpbCA9IHRhaWw7XG4gIHJldHVybiBjaGFpbi5jaGFpbiA9IGNoYWluXG4gIGZ1bmN0aW9uIGNoYWluKGZuKSB7XG4gICAgY2hhaW4udGFpbCA9IGZuKGNoYWluLnRhaWwpO1xuICAgIHJldHVybiBjaGFpbn0gfVxuXG5jb25zdCBhb19kZWZlcnJlZF92ID0gKCgoKSA9PiB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgW3AsIHksIG5dKSB9KSgpKTtcblxuY29uc3QgYW9fZGVmZXJyZWQgPSB2ID0+KFxuICB2ID0gYW9fZGVmZXJyZWRfdigpXG4sIHtwcm9taXNlOiB2WzBdLCByZXNvbHZlOiB2WzFdLCByZWplY3Q6IHZbMl19KTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuXG5mdW5jdGlvbiAqIGl0ZXIoaXRlcmFibGUpIHtcbiAgeWllbGQgKiBpdGVyYWJsZTt9XG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGl0ZXJhYmxlKSB7XG4gIHlpZWxkICogaXRlcmFibGU7fVxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXJfZmVuY2VkKGl0ZXJhYmxlLCBmX2dhdGUsIGluaXRpYWw9ZmFsc2UpIHtcbiAgbGV0IGYgPSB0cnVlID09PSBpbml0aWFsID8gZl9nYXRlLmZlbmNlKCkgOiBpbml0aWFsO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgYXdhaXQgZjtcbiAgICB5aWVsZCB2O1xuICAgIGYgPSBmX2dhdGUuZmVuY2UoKTt9IH1cblxuZnVuY3Rpb24gYW9fZmVuY2Vfdihwcm90bykge1xuICBsZXQgcD0wLCBfcmVzdW1lID0gXz0+MCwgX2Fib3J0ID0gXz0+MDtcbiAgbGV0IF9wc2V0ID0gKHksbikgPT4ge19yZXN1bWU9eTsgX2Fib3J0PW47fTtcblxuICBsZXQgZmVuY2UgPSAoKSA9PigwICE9PSBwID8gcCA6IHA9bmV3IFByb21pc2UoX3BzZXQpKTtcbiAgbGV0IHJlc3VtZSA9IChhbnMpID0+KHA9MCwgX3Jlc3VtZShhbnMpKTtcbiAgbGV0IGFib3J0ID0gKGVycj1hb19kb25lKSA9PihwPTAsIF9hYm9ydChlcnIpKTtcblxuICByZXR1cm4gcHJvdG9cbiAgICA/e19fcHJvdG9fXzogcHJvdG8sIGZlbmNlLCByZXN1bWUsIGFib3J0fVxuICAgIDpbZmVuY2UsIHJlc3VtZSwgYWJvcnRdIH1cblxuXG5cbmNvbnN0IF9hb19mZW5jZV9jb3JlX2FwaV8gPXtcbiAgYW9fY2hlY2tfZG9uZVxuLCBjaGFpbihmbikge3JldHVybiBmbl9jaGFpbih0aGlzKShmbil9XG5cbiwgLy8gY29weWFibGUgZmVuY2UgZm9yayBhcGlcbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYW9fZm9yaygpIHtcbiAgICBsZXQgYWcgPSB0aGlzLl9hb19mb3JrKCk7XG4gICAgbGV0IHt4ZW1pdH0gPSB0aGlzO1xuICAgIHJldHVybiB4ZW1pdCA/IHhlbWl0KGFnKSA6IGFnfVxuXG4sIGFzeW5jICogX2FvX2ZvcmsoKSB7XG4gICAgbGV0IHtmZW5jZX0gPSB0aGlzO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgciA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHIpIHtcbiAgICAgICAgICB5aWVsZCByO30gfSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfY29yZV9hcGlfKTtcbiAgcmV0dXJuIGZ9XG5cblxuY29uc3QgX2FvX2ZlbmNlX2dlbl9hcGlfID17XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIC8vIGdlbmVyYXRvciBhcGlcbiAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuLCByZXR1cm4oKSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5hYm9ydChhb19kb25lKSwgZG9uZTogdHJ1ZX19XG4sIHRocm93KGVycikge3JldHVybiB7dmFsdWU6IHRoaXMuYWJvcnQoZXJyKSwgZG9uZTogdHJ1ZX19IH07XG5cblxuY29uc3QgYW9fZmVuY2Vfb2JqID1cbiAgYW9fZmVuY2Vfdi5iaW5kKG51bGwsIF9hb19mZW5jZV9nZW5fYXBpXyk7XG5cbmZ1bmN0aW9uIGFvX3NwbGl0KGl0ZXJhYmxlKSB7XG4gIGxldCBmX291dCA9IGFvX2ZlbmNlX29iaigpO1xuICBmX291dC53aGVuX3J1biA9IF9hb19ydW4oaXRlcmFibGUsIGZfb3V0KTtcbiAgZl9vdXQuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBmX291dH1cblxuYXN5bmMgZnVuY3Rpb24gX2FvX3J1bihpdGVyYWJsZSwgZ190YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBnX3RhcC5uZXh0KHYpO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuXG4gIGZpbmFsbHkge1xuICAgIGdfdGFwLnJldHVybigpO30gfVxuXG5cbmZ1bmN0aW9uIGFvX3RhcChpdGVyYWJsZSkge1xuICBsZXQgZl90YXAgPSBhb19mZW5jZV9vYmooKTtcbiAgbGV0IGFnX3RhcCA9IF9hb190YXAoaXRlcmFibGUsIGZfdGFwKTtcbiAgYWdfdGFwLmZfdGFwID0gYWdfdGFwLmZfb3V0ID0gZl90YXA7XG4gIGFnX3RhcC5nX2luID0gZl90YXAuZ19pbiA9IGl0ZXJhYmxlLmdfaW47XG4gIHJldHVybiBbZl90YXAsIGFnX3RhcF19XG5cbmFzeW5jIGZ1bmN0aW9uICogX2FvX3RhcChpdGVyYWJsZSwgZ190YXApIHtcbiAgdHJ5IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIGl0ZXJhYmxlKSB7XG4gICAgICBnX3RhcC5uZXh0KHYpO1xuICAgICAgeWllbGQgdjt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cblxuICBmaW5hbGx5IHtcbiAgICBnX3RhcC5yZXR1cm4oKTt9IH1cblxuY29uc3QgX2FvX291dF9tdWx0aXBsZSA9ICgoKSA9PiB7XG4gIHRocm93IG5ldyBFcnJvcignYW9fZmVuY2Vfb3V0IGFscmVhZHkgY29uc3VtZWQnKX0pO1xuXG5jb25zdCBhb19mZW5jZV9vdXQgPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2NvcmVfYXBpX1xuXG4sIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7cmV0dXJuIHRoaXMuYW9fYm91bmQoKX1cbiwgYW9fYm91bmQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhb19mZW5jZV9vdXQgbm90IGJvdW5kJyl9XG5cbiwgYW9fcnVuKCkge1xuICAgIGxldCB7d2hlbl9ydW59ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkID09PSB3aGVuX3J1bikge1xuICAgICAgdGhpcy53aGVuX3J1biA9IHdoZW5fcnVuID1cbiAgICAgICAgYW9fcnVuKHRoaXMpO31cbiAgICByZXR1cm4gd2hlbl9ydW59XG5cbiwgYmluZF9nYXRlZChmX2dhdGUpIHtcbiAgICBsZXQgYWdfb3V0ID0gdGhpcy5fYW9fZ2F0ZWQoZl9nYXRlKTtcbiAgICBhZ19vdXQuZl9vdXQgPSB0aGlzO1xuICAgIGFnX291dC5nX2luID0gdGhpcy5nX2luO1xuICAgIHRoaXMuYW9fYm91bmQgPSAoKCkgPT4ge1xuICAgICAgdGhpcy5hb19ib3VuZCA9IF9hb19vdXRfbXVsdGlwbGU7XG4gICAgICBsZXQge3hlbWl0fSA9IHRoaXM7XG4gICAgICByZXR1cm4geGVtaXQgPyB4ZW1pdChhZ19vdXQpIDogYWdfb3V0fSk7XG5cbiAgICByZXR1cm4gdGhpc31cblxuLCBhc3luYyAqIF9hb19nYXRlZChmX2dhdGUpIHtcbiAgICB0cnkge1xuICAgICAgdGhpcy5yZXN1bWUoKTtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICAgIHlpZWxkIHY7XG4gICAgICAgIHRoaXMucmVzdW1lKHYpO30gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gICAgZmluYWxseSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTtcbiAgICAgIHRoaXMuYWJvcnQoKTt9IH0gfSApO1xuXG5jb25zdCBhb194Zm9ybSA9IG5zX2dlbiA9PiBhb19mZW5jZV9pbigpLmFvX3hmb3JtKG5zX2dlbik7XG5jb25zdCBhb19mb2xkID0gbnNfZ2VuID0+IGFvX2ZlbmNlX2luKCkuYW9fZm9sZChuc19nZW4pO1xuY29uc3QgYW9fcXVldWUgPSBuc19nZW4gPT4gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZShuc19nZW4pO1xuXG5jb25zdCBhb19mZW5jZV9pbiA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfZ2VuX2FwaV9cblxuLCBhb19mb2xkKG5zX2dlbikge3JldHVybiB0aGlzLmFvX3hmb3JtKHt4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KX1cbiwgYW9fcXVldWUobnNfZ2VuKSB7cmV0dXJuIHRoaXMuYW9feGZvcm0oe3hpbml0OiBhb2dfc2luaywgLi4uIG5zX2dlbn0pfVxuXG4sIGFvZ19pdGVyKHhmKSB7cmV0dXJuIGFvZ19pdGVyKHRoaXMpfVxuLCBhb2dfc2luayhmX2dhdGUsIHhmKSB7cmV0dXJuIGFvZ19zaW5rKHRoaXMsIGZfZ2F0ZSwgeGYpfVxuXG4sIGFvX3hmb3JtKG5zX2dlbj17eGluaXQ6IGFvZ19zaW5rfSkge1xuICAgIGxldCBmX291dCA9IGFvX2ZlbmNlX291dCgpO1xuXG4gICAgbGV0IHt4aW5pdCwgeHJlY3YsIHhlbWl0fSA9IFxuICAgICAgaXNfYW9fZm4obnNfZ2VuKVxuICAgICAgICA/IG5zX2dlbih0aGlzLCBmX291dClcbiAgICAgICAgOiBuc19nZW47XG5cbiAgICBmX291dC54ZW1pdCA9IHhlbWl0O1xuICAgIGlmICghIHhpbml0KSB7eGluaXQgPSBhb2dfc2luazt9XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBsZXQgYWdfb3V0LCBnX2luID0gcmVzLmdfaW4gfHwgcmVzO1xuICAgIGlmIChyZXMgPT09IGdfaW4pIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIGdfaW4ubmV4dCgpO1xuICAgICAgYWdfb3V0ID0gZl9vdXQuYmluZF9nYXRlZCh0aGlzKTt9XG5cbiAgICAvLyBlbHNlIHJlcyBpcyBhbiBvdXRwdXQgZ2VuZXJhdG9yXG5cbiAgICBhZ19vdXQuZ19pbiA9IGZfb3V0LmdfaW4gPSBnX2luO1xuICAgIHJldHVybiBhZ19vdXR9IH0gKTtcblxuXG5mdW5jdGlvbiAqIGFvZ19pdGVyKGcsIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgIHRpcCA9IHhmLm5leHQodGlwKS52YWx1ZTt9XG4gICAgICBnLm5leHQodGlwKTt9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZy5yZXR1cm4oKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvZ19zaW5rKGcsIGZfZ2F0ZSwgeGYpIHtcbiAgeGYgPSB4ZiA/IF94Zl9nZW4uY3JlYXRlKHhmKSA6IHZvaWQgeGY7XG4gIHRyeSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgICB7XG4gICAgICAgIGxldCB0aXAgPSB5aWVsZDtcbiAgICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgICB0aXAgPSBhd2FpdCB4Zi5uZXh0KHRpcCk7XG4gICAgICAgICAgdGlwID0gdGlwLnZhbHVlO31cbiAgICAgICAgYXdhaXQgZy5uZXh0KHRpcCk7fVxuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBmX2dhdGUpIHtcbiAgICAgICAgYXdhaXQgZl9nYXRlLmZlbmNlKCk7fSB9IH1cblxuICBjYXRjaCAoZXJyKSB7XG4gICAgYW9fY2hlY2tfZG9uZShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZy5yZXR1cm4oKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5jb25zdCBfeGZfZ2VuID17XG4gIGNyZWF0ZSh4Zikge1xuICAgIGxldCBzZWxmID0ge19fcHJvdG9fXzogdGhpc307XG4gICAgc2VsZi54ZyA9IHhmKHNlbGYueGZfaW52KCkpO1xuICAgIHJldHVybiBzZWxmfVxuXG4sICp4Zl9pbnYoKSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB0aGlzLl90aXA7XG4gICAgICBpZiAodGhpcyA9PT0gdGlwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5kZXJmbG93Jyl9XG4gICAgICBlbHNlIHRoaXMuX3RpcCA9IHRoaXM7XG5cbiAgICAgIHlpZWxkIHRpcDt9IH1cblxuLCBuZXh0KHYpIHtcbiAgICB0aGlzLl90aXAgPSB2O1xuICAgIHJldHVybiB0aGlzLnhnLm5leHQodil9XG5cbiwgcmV0dXJuKCkge3RoaXMueGcucmV0dXJuKCk7fVxuLCB0aHJvdygpIHt0aGlzLnhnLnRocm93KCk7fSB9O1xuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwLCBnZW5faW4pIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXN1bWUsIF9hYm9ydF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc3VtZSwgbXMsIDEpO1xuICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICBfZmVuY2Uuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJJbnRlcnZhbCh0aWQpO1xuICAgIF9hYm9ydCgpO30pO1xuXG4gIHJldHVybiBudWxsID09IGdlbl9pbiA/IF9mZW5jZVxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCBfZmVuY2UpfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG5cbiAgcmV0dXJuIG51bGwgPT0gZ2VuX2luID8gdGltZW91dFxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCB0aW1lb3V0KVxuXG4gIGZ1bmN0aW9uIHRpbWVvdXQoKSB7XG4gICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLmZpbiA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcDtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgICBwID0gX2ZlbmNlKCk7XG4gICAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc3VtZSwgbXMsIHYpO31cblxuICAgICAgYXdhaXQgcDt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcblxuICByZXR1cm4gbnVsbCA9PSBnZW5faW4gPyByYWZcbiAgICA6IGFvX2l0ZXJfZmVuY2VkKGdlbl9pbiwgcmFmKVxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc3VtZSk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IF9ldnRfaW5pdCA9IFByb21pc2UucmVzb2x2ZSh7dHlwZTonaW5pdCd9KTtcbmZ1bmN0aW9uIGFvX2RvbV9saXN0ZW4oc2VsZj1hb19xdWV1ZSgpKSB7XG4gIHJldHVybiBfYmluZC5zZWxmID0gc2VsZiA9e1xuICAgIF9fcHJvdG9fXzogc2VsZlxuICAsIHdpdGhfZG9tKGRvbSwgZm4pIHtcbiAgICAgIHJldHVybiBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgICAgOiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZG9tKX0gfVxuXG4gIGZ1bmN0aW9uIF9iaW5kKGRvbSwgZm5fZXZ0LCBmbl9kb20pIHtcbiAgICByZXR1cm4gZXZ0ID0+IHtcbiAgICAgIGxldCB2ID0gZm5fZXZ0XG4gICAgICAgID8gZm5fZXZ0KGV2dCwgZG9tLCBmbl9kb20pXG4gICAgICAgIDogZm5fZG9tKGRvbSwgZXZ0KTtcblxuICAgICAgaWYgKG51bGwgIT0gdikge1xuICAgICAgICBzZWxmLmdfaW4ubmV4dCh2KTt9IH0gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSB7XG4gIGxldCBfb25fZXZ0O1xuICBpZiAoaXNfYW9fZm4oZm4pKSB7XG4gICAgX2V2dF9pbml0LnRoZW4oXG4gICAgICBfb25fZXZ0ID0gX2JpbmQoZG9tLCB2b2lkIDAsIGZuKSk7IH1cblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBsZXQgb3B0LCBldnRfZm4gPSBfb25fZXZ0O1xuXG4gICAgICBsZXQgbGFzdCA9IGFyZ3MucG9wKCk7XG4gICAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgZXZ0X2ZuID0gX2JpbmQoZG9tLCBsYXN0LCBfb25fZXZ0KTtcbiAgICAgICAgbGFzdCA9IGFyZ3MucG9wKCk7fVxuXG4gICAgICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGFyZ3MucHVzaChsYXN0KTt9XG4gICAgICBlbHNlIG9wdCA9IGxhc3Q7XG5cbiAgICAgIGZvciAobGV0IGV2dCBvZiBhcmdzKSB7XG4gICAgICAgIGRvbS5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgICAgIGV2dCwgZXZ0X2ZuLCBvcHQpOyB9XG5cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb21fdmVjKF9iaW5kLCBmbiwgZWN0eF9saXN0KSB7XG4gIGVjdHhfbGlzdCA9IEFycmF5LmZyb20oZWN0eF9saXN0LFxuICAgIGRvbSA9PiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pKTtcblxuICByZXR1cm4ge1xuICAgIF9fcHJvdG9fXzogX2JpbmQuc2VsZlxuICAsIGxpc3RlbiguLi5hcmdzKSB7XG4gICAgICBmb3IgKGxldCBlY3R4IG9mIGVjdHhfbGlzdCkge1xuICAgICAgICBlY3R4Lmxpc3RlbiguLi5hcmdzKTt9XG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cbmV4cG9ydCB7IF9hb19mZW5jZV9jb3JlX2FwaV8sIF9hb19mZW5jZV9nZW5fYXBpXywgX2FvX3J1biwgX2FvX3RhcCwgX3hmX2dlbiwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fbGlzdGVuLCBhb19kb25lLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2luLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX291dCwgYW9fZmVuY2VfdiwgYW9fZm9sZCwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX2l0ZXJfZmVuY2VkLCBhb19xdWV1ZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb194Zm9ybSwgYW9nX2l0ZXIsIGFvZ19zaW5rLCBmbl9jaGFpbiwgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcnJlZCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRcbiAgICBpc19mbiBAIGFvX2RlZmVycmVkX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfaW5cblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4iLCJpbXBvcnQge2FvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19kZWZlcnJlZCcsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVycmVkX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWRfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWQgb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5wcm9taXNlKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMucmVzb2x2ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZWplY3QpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4oZylcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBpdCBAICdhb19zcGxpdCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3Mud2hlbl9ydW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgaXQgQCAnYW9fdGFwIHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgW2Zfb3V0LCBhZ190YXBdID0gYW9fdGFwKGcpXG4gICAgICBpc19hc3luY19pdGVyYWJsZSBAIGZfb3V0XG4gICAgICBpc19nZW4gQCBhZ190YXBcblxuICAgICAgZXhwZWN0KGZfb3V0LmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZl9vdXQuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dClcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFnX3RhcClcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBkZWxheV9yYWNlfSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICBsZXQgZlxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3R3bycsIGF3YWl0IGZcblxuICAgIHJlc3VtZSBAICdmb3VyJ1xuICAgIHJlc3VtZSBAICdmaXZlJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3NpeCdcbiAgICByZXN1bWUgQCAnc2V2ZW4nXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAnc2l4JywgYXdhaXQgZlxuXG5cbiAgaXQgQCAnbmV2ZXIgYmxvY2tlZCBvbiBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cblxuICBpdCBAICdleGVyY2lzZSBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGxldCB2ID0gJ2EnXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdhJylcblxuICAgIGNvbnN0IHAgPSBAIT5cbiAgICAgIHYgPSAnYidcblxuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2JiJylcblxuICAgICAgdiA9ICdjJ1xuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2NjJylcbiAgICAgIHYgPSAnZCdcbiAgICAgIHJldHVybiAxOTQyXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdkJylcblxuIiwiaW1wb3J0IHthb19mZW5jZV9mbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7XG4gIGFzc2VydCwgZXhwZWN0LCBcbiAgaXNfZmVuY2VfY29yZSxcbiAgZGVsYXlfcmFjZSwgZGVsYXlcbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2ZuJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXNfZmVuY2VfY29yZShyZXNbMF0pXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IGZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9vdXR9IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCwgXG4gIGlzX2ZlbmNlX2NvcmUsIGlzX2ZlbmNlX2dlbixcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vYmonLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZmVuY2VfZ2VuIEAgYW9fZmVuY2Vfb2JqKClcblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vdXQnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfY29yZSBAIGFvX2ZlbmNlX291dCgpXG4gICAgZXhwZWN0KHJlcy5hb19ib3VuZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5iaW5kX2dhdGVkKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge1xuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZmVuY2VfZ2VuLFxuICBkZWxheV9yYWNlLCBkZWxheVxufSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4nLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBpc19mZW5jZV9nZW4gQCBhb19mZW5jZV9pbigpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fZm9sZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb2dfc2luaykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICByZXMucmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3BpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gIGl0IEAgJ3NpbXBsZScsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb194Zm9ybSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0IHBvc3QgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4aW5pdCBjb250ZXh0IGdfaW4nLCBAOjo+XG4gICAgbGV0IGxvZz1bXVxuXG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm0gQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19mb2xkKCknLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICBpdCBAICdzaW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hyZWN2IHN1bSBwcmUgdHJhbnNmb3JtJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICBzICs9IHZcbiAgICAgICAgICB5aWVsZCBzXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSAxOTQyLCAxOTQyKzIwNDIsIDE5NDIrMjA0MisyMTQyXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGVtaXQgcG9zdCB0cmFuc2Zvcm0nLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fZm9sZCBAOlxuICAgICAgYXN5bmMgKiB4ZW1pdChnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneGluaXQgY29udGV4dCBnX2luJywgQDo6PlxuICAgIGxldCBsb2c9W11cblxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX2ZvbGQgQDpcbiAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICBsZXQgdGlkID0gc2V0VGltZW91dCBAIFxuICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgIHRyeSA6OlxuICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0J1xuXG4gICAgYXdhaXQgZGVsYXkoNSlcbiAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICd4Y3R4IHN0YXJ0JywgJ3hjdHggZmluJ1xuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2l0ZXIsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBkZWxheV93YWxrLCBhcnJheV9mcm9tX2FvX2l0ZXIsXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgaXQgQCAnc2luZ2xlcycsIEA6Oj5cbiAgICBsZXQgc29tZV9xdWV1ZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgbGV0IHBfb3V0MSA9IGFvX2l0ZXIoc29tZV9xdWV1ZSkubmV4dCgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9faW50ZXJ2YWwsIGFvX3RpbWVvdXQsIGFvX2RlYm91bmNlLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fdGltZW91dCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG5cbiAgaXQgQCAnYW9fZGVib3VuY2UnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2RlYm91bmNlKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICBleHBlY3QoYW90LmZpbikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgYXNzZXJ0LmVxdWFsKDE1LCB2YWx1ZSlcblxuICAgIGF3YWl0IGFvdC5maW5cblxuXG4gIGl0IEAgJ2FvX2ludGVydmFsIGFzIHJhdGUgbGltaXQnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQFxuICAgICAgYW9faW50ZXJ2YWwoMTAsIFszMCwgMjAsIDEwLCAxNV0pXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgZXhwZWN0KHZhbHVlKS50by5lcXVhbCgzMClcblxuICAgIGxldCBsc3QgPSBbdmFsdWVdXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgIGxzdC5wdXNoKHYpXG5cbiAgICBleHBlY3QobHN0KS50by5kZWVwLmVxdWFsIEBcbiAgICAgIFszMCwgMjAsIDEwLCAxNV1cblxuXG4gIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19pbnRlcnZhbCgxMClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fYW5pbWF0aW9uLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gYW5pbWF0aW9uIGZyYW1lcycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2FuaW1hdGlvblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDo6XG5cbiAgICBpdCBAICdhb19kb21fYW5pbWF0aW9uJywgQDo6PlxuICAgICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2FuaW1hdGlvbigpXG4gICAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh2YWx1ZSA+PSAwKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcblxuICAgIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2RvbV9hbmltYXRpb24oKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9saXN0ZW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBhcnJheV9mcm9tX2FvX2l0ZXJcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gZXZlbnRzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fbGlzdGVuXG5cbiAgICBsZXQgZGUgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9saXN0ZW4oKVxuICAgIGlzX2dlbiBAIGRlLmdfaW5cbiAgICBpc19mbiBAIGRlLndpdGhfZG9tXG5cblxuICBpdCBAICdzaGFwZSBvZiB3aXRoX2RvbScsIEA6OlxuICAgIGxldCBtb2NrID0gQHt9XG4gICAgICBhZGRFdmVudExpc3RlbmVyKGV2dCwgZm4sIG9wdCkgOjpcblxuICAgIGxldCBlX2N0eCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgLndpdGhfZG9tKG1vY2spXG5cbiAgICBpc19mbiBAIGVfY3R4LndpdGhfZG9tXG4gICAgaXNfZm4gQCBlX2N0eC5saXN0ZW5cblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgOjpcblxuICAgIGl0IEAgJ21lc3NhZ2UgY2hhbm5lbHMnLCBAOjo+XG4gICAgICBjb25zdCB7cG9ydDEsIHBvcnQyfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpXG5cbiAgICAgIGNvbnN0IGFvX3RndCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYW9fdGd0KVxuXG4gICAgICBhb190Z3RcbiAgICAgICAgLndpdGhfZG9tIEAgcG9ydDIsIHZvaWQgcG9ydDIuc3RhcnQoKVxuICAgICAgICAubGlzdGVuIEAgJ21lc3NhZ2UnLCBldnQgPT4gQDogdGVzdF9uYW1lOiBldnQuZGF0YVxuXG4gICAgICA6OiE+XG4gICAgICAgIGZvciBsZXQgbSBvZiBbJ2EnLCAnYicsICdjJ10gOjpcbiAgICAgICAgICBwb3J0MS5wb3N0TWVzc2FnZSBAIGBmcm9tIG1zZyBwb3J0MTogJHttfWBcbiAgICAgICAgICBhd2FpdCBkZWxheSgxKVxuXG4gICAgICAgIGFvX3RndC5nX2luLnJldHVybigpXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGEnXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYidcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztFQUFBLG1DQUFtQyxNQUFNOzs7SUFJdkMsWUFBYTtNQUNYLFdBQVksT0FBUTs7O0lBR3RCLGNBQWU7OztJQUdmO2VBQ1M7TUFDUDtNQUNBOzs7SUFHRixtQkFBbUIsVUFBVTtJQUM3Qjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ3JERixNQUFNLFVBQVUsR0FBRyxDQUFDO0VBQ3BCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENB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
