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

  function is_fence_basic(f) {
    is_fn(f.fence);
    is_fn(f.ao_fork);
    is_async_iterable(f);
    return f}

  function is_fence_full(f) {
    is_fence_basic(f);
    is_fn(f.abort);
    is_fn(f.resume);

    is_fn(f.next);
    is_fn(f.return);
    is_fn(f.throw);

    is_fn(f.ao_check_done);
    is_fn(f.chain);
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

      is_fence_basic(res[0]);}) );


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
      const res = is_fence_full(ao_fence_obj());
      expect(res.ao_gated).to.be.a('function');}) );


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

  describe('ao_fence_in', (() => {
    it('shape', (() => {
      const res = is_fence_full(ao_fence_in());

      expect(res.ao_xform_tap).to.be.a('function');
      expect(res.ao_xform_run).to.be.a('function');
      expect(res.ao_xform_raw).to.be.a('function');

      expect(res.ao_queue).to.be.a('function');
      expect(res.aog_sink).to.be.a('function');

      expect(res.ao_pipe).to.be.a('function');
      expect(res.aog_iter).to.be.a('function');}) );


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

  describe('ao_fence_in.ao_queue', function() {
    it('shape', (() => {
      let some_queue = is_async_iterable(
        ao_fence_in().ao_queue());

      is_gen(some_queue.g_in);
      expect(some_queue.fence).to.be.a('function');
      expect(some_queue.when_run).to.be.a('promise');}) );

    it('singles', (async () => {
      let some_queue = ao_fence_in().ao_queue();

      let p_out1 = some_queue.fence();
      expect(p_out1).to.be.a('promise');

      let p_in1 = some_queue.g_in.next('first');
      expect(p_in1).to.be.a('promise');

      expect(await p_out1).to.equal('first'); }) );

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

  describe('ao_fence_in.ao_pipe basics', function() {
    it('shape', (() => {
      let some_pipe = is_async_iterable(
        ao_fence_in().ao_pipe());

      is_gen(some_pipe.g_in);
      expect(some_pipe.fence).to.be.a('function');
      expect(some_pipe.when_run).to.be.a('promise');}) );

    it('example', (async () => {
      let some_pipe = ao_fence_in().ao_pipe();
      let z = _test_pipe_out(some_pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 2042, 2142]
      , await delay_race(z, 50)); }) );

    it('xfold', (async () => {
      let some_pipe = ao_fence_in().ao_pipe({
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


    it('xemit', (async () => {
      let some_pipe = ao_fence_in().ao_pipe({
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


    async function _test_pipe_out(some_pipe, values) {
      let z = array_from_ao_iter(some_pipe);

      await ao_drive(
        delay_walk(values)
      , some_pipe.g_in, true);

      return z} } );

  describe('ao_fence_in.ao_pipe advanced', function() {
    describe('compute', (() => {
      it('xfold', (async () => {
        let some_pipe = ao_fence_in().ao_pipe({
          *xrecv(g) {
            for (let v of g) {
              yield v + 1000;} } });

        let z = array_from_ao_iter(some_pipe);

        await ao_drive(
          delay_walk([30,20,10])
        , some_pipe.g_in, true);

        assert.deepEqual(await z,[1030, 1020, 1010]); }) );


      it('*xgfold', (async () => {
        let some_pipe = ao_fence_in().ao_pipe({
          *xrecv(g) {
            let s = 0;
            for (let v of g) {
              s += v + 1000;
              yield s;} } });

        let z = array_from_ao_iter(some_pipe);

        await ao_drive(
          delay_walk([30,20,10])
        , some_pipe.g_in, true);

        assert.deepEqual(await z,[1030, 2050, 3060]); }) );


      it('xctx', (async () => {
        let log=[];

        let some_pipe = ao_fence_in().ao_pipe({
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

        assert.deepEqual(await z,['bingo']); }) ); }) );


    describe('output async generator', (() => {
      it('raw', (async () => {
        let gs = is_gen(
          ao_fence_in().ao_xform_raw());

        let v0 = gs.next();
        expect(v0).to.be.a('promise');

        let pd = ao_drive(
          delay_walk([30,20,10])
        , gs.g_in, true);

        let pr = ao_run(gs);
        expect(pr).to.be.a('promise');
        expect(await pr).to.be.undefined;
        expect(await pd).to.be.undefined;

        let v1 = gs.next();
        expect(v1).to.be.a('promise');

        expect(await v0).to.deep.equal({value: 30, done: false});
        expect(await v1).to.deep.equal({value: undefined, done: true}); }) );


      it('tap', (async () => {
        let [f_tap, ag_tap] = ao_fence_in().ao_xform_tap();

        is_async_iterable(f_tap);
        is_gen(ag_tap);
        is_gen(f_tap.g_in);
        is_gen(ag_tap.g_in);
        assert(f_tap.g_in === ag_tap.g_in, "has same g_in");

        let a = array_from_ao_iter(f_tap.ao_fork());
        let b = array_from_ao_iter(f_tap.ao_fork());

        let z = array_from_ao_iter(f_tap);
        expect(f_tap.fence).to.be.a('function');

        ao_drive(
          delay_walk([30,20,10])
        , f_tap.g_in, true);

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

        await ao_run(ag_tap);

        expect(await z).to.deep.equal([30, 20, 10]);
        expect(await a).to.deep.equal([30, 20, 10]);
        expect(await b).to.deep.equal([30, 20, 10]); }) );


      it('split', (async () => {
        let gs = is_async_iterable(
          ao_fence_in().ao_xform_run());

        let a = array_from_ao_iter(gs);
        let b = array_from_ao_iter(gs.ao_fork());
        let z = array_from_ao_iter(gs);

        expect(gs.fence).to.be.a('function');
        expect(gs.when_run).to.be.a('promise');

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

        ao_drive(
          delay_walk([30,20,10])
        , gs.g_in, true);

        let p = gs.fence();
        expect(p).to.be.a('promise');
        expect(await p).to.equal(30);

        expect(await z).to.deep.equal([30, 20, 10]);
        expect(await a).to.deep.equal([30, 20, 10]);
        expect(await b).to.deep.equal([30, 20, 10]); }) ); }) ); } );

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

      let de = is_gen(ao_dom_listen());
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVycmVkLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L3BpcGVfYmFzZS5qc3kiLCIuLi91bml0L3BpcGUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2Jhc2ljKGYpIDo6XG4gIGlzX2ZuKGYuZmVuY2UpXG4gIGlzX2ZuKGYuYW9fZm9yaylcbiAgaXNfYXN5bmNfaXRlcmFibGUoZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2Z1bGwoZikgOjpcbiAgaXNfZmVuY2VfYmFzaWMoZilcbiAgaXNfZm4oZi5hYm9ydClcbiAgaXNfZm4oZi5yZXN1bWUpXG5cbiAgaXNfZm4oZi5uZXh0KVxuICBpc19mbihmLnJldHVybilcbiAgaXNfZm4oZi50aHJvdylcblxuICBpc19mbihmLmFvX2NoZWNrX2RvbmUpXG4gIGlzX2ZuKGYuY2hhaW4pXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19hc3luY19pdGVyYWJsZShvKSA6OlxuICBhc3NlcnQgQCBudWxsICE9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCAnYXN5bmMgaXRlcmFibGUnXG4gIHJldHVybiBvXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcnJheV9mcm9tX2FvX2l0ZXIoZykgOjpcbiAgbGV0IHJlcyA9IFtdXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgcmVzLnB1c2godilcbiAgcmV0dXJuIHJlc1xuXG4iLCJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUkMSA9IGVyciA9PiB7XG4gIGlmIChlcnIgIT09IGFvX2RvbmUgJiYgZXJyICYmICFlcnIuYW9fZG9uZSkge1xuICAgIHRocm93IGVycn1cbiAgcmV0dXJuIHRydWV9O1xuXG5cbmZ1bmN0aW9uICogaXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBnZW5faW47fVxuYXN5bmMgZnVuY3Rpb24gKiBhb19pdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIGdlbl9pbjt9XG5cblxuZnVuY3Rpb24gZm5fY2hhaW4odGFpbCkge1xuICBjaGFpbi50YWlsID0gdGFpbDtcbiAgcmV0dXJuIGNoYWluLmNoYWluID0gY2hhaW5cbiAgZnVuY3Rpb24gY2hhaW4oZm4pIHtcbiAgICBjaGFpbi50YWlsID0gZm4oY2hhaW4udGFpbCk7XG4gICAgcmV0dXJuIGNoYWlufSB9XG5cbmNvbnN0IGFvX2RlZmVycmVkX3YgPSAoKCgpID0+IHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBbcCwgeSwgbl0pIH0pKCkpO1xuXG5jb25zdCBhb19kZWZlcnJlZCA9IHYgPT4oXG4gIHYgPSBhb19kZWZlcnJlZF92KClcbiwge3Byb21pc2U6IHZbMF0sIHJlc29sdmU6IHZbMV0sIHJlamVjdDogdlsyXX0pO1xuXG5hc3luYyBmdW5jdGlvbiBhb19ydW4oZ2VuX2luKSB7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7fSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gYW9fZHJpdmUoZ2VuX2luLCBnZW5fdGd0LCBjbG9zZV90Z3QpIHtcbiAgaWYgKGlzX2FvX2ZuKGdlbl90Z3QpKSB7XG4gICAgZ2VuX3RndCA9IGdlbl90Z3QoKTtcbiAgICBnZW5fdGd0Lm5leHQoKTt9XG5cbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICBsZXQge2RvbmV9ID0gYXdhaXQgZ2VuX3RndC5uZXh0KHYpO1xuICAgIGlmIChkb25lKSB7YnJlYWt9IH1cblxuICBpZiAoY2xvc2VfdGd0KSB7XG4gICAgYXdhaXQgZ2VuX3RndC5yZXR1cm4oKTt9IH1cblxuXG5mdW5jdGlvbiBhb19zdGVwX2l0ZXIoaXRlcmFibGUsIG9yX21vcmUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWUsIGRvbmV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICBpZiAoZG9uZSkge3JldHVybiB2YWx1ZX1cbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG9yX21vcmUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5mdW5jdGlvbiBhb19mZW5jZV92KHByb3RvKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSBfPT4wLCBfYWJvcnQgPSBfPT4wO1xuICBsZXQgX3BzZXQgPSAoeSxuKSA9PiB7X3Jlc3VtZT15OyBfYWJvcnQ9bjt9O1xuXG4gIGxldCBmZW5jZSA9ICgpID0+KDAgIT09IHAgPyBwIDogcD1uZXcgUHJvbWlzZShfcHNldCkpO1xuICBsZXQgcmVzdW1lID0gKGFucykgPT4ocD0wLCBfcmVzdW1lKGFucykpO1xuICBsZXQgYWJvcnQgPSAoZXJyPWFvX2RvbmUpID0+KHA9MCwgX2Fib3J0KGVycikpO1xuXG4gIHJldHVybiBwcm90b1xuICAgID97X19wcm90b19fOiBwcm90bywgZmVuY2UsIHJlc3VtZSwgYWJvcnR9XG4gICAgOltmZW5jZSwgcmVzdW1lLCBhYm9ydF0gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2FwaV8gPXtcbiAgX19wcm90b19fOntcbiAgICAvLyBnZW5lcmF0b3IgYXBpXG4gICAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuICAsIHJldHVybigpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGFvX2RvbmUpLCBkb25lOiB0cnVlfX1cbiAgLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fVxuXG4gICwgYW9fY2hlY2tfZG9uZTogYW9fY2hlY2tfZG9uZSQxXG4gICwgY2hhaW4oZm4pIHtyZXR1cm4gZm5fY2hhaW4odGhpcykoZm4pfSB9XG5cbiwgLy8gY29weWFibGUgZmVuY2UgYXBpXG5cbiAgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9XG5cbiwgYXN5bmMgKiBhb19mb3JrKCkge1xuICAgIGxldCB7ZmVuY2V9ID0gdGhpcztcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgeWllbGQgYXdhaXQgZmVuY2UoKTt9IH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lJDEoZXJyKTt9IH0gfTtcblxuXG5mdW5jdGlvbiBhb19mZW5jZV9mbih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV92KCk7XG4gIGlmICh1bmRlZmluZWQgPT09IHRndCkge3RndCA9IGZbMF07fVxuICB0Z3QuZmVuY2UgPSBPYmplY3QuYXNzaWduKHRndCwgX2FvX2ZlbmNlX2FwaV8pO1xuICByZXR1cm4gZn1cblxuXG5jb25zdCBhb19mZW5jZV9vYmogPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaV9cblxuLCBhc3luYyAqIGFvX2dhdGVkKGZfZ2F0ZSkge1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAoMSkge1xuICAgICAgICBsZXQgdiA9IGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO1xuICAgICAgICB5aWVsZCB2O1xuICAgICAgICB0aGlzLnJlc3VtZSh2KTt9IH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lJDEoZXJyKTt9XG4gICAgZmluYWxseSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTtcbiAgICAgIHRoaXMuYWJvcnQoKTt9IH0gfSApO1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IHtmX291dH0gPSBhZ19vdXQ7XG4gIGlmICh1bmRlZmluZWQgPT09IGZfb3V0KSB7XG4gICAgW2Zfb3V0LCBhZ19vdXRdID0gYW9fdGFwKGFnX291dCk7fVxuXG4gIGZfb3V0LndoZW5fcnVuID0gYW9fcnVuKGFnX291dCk7XG4gIHJldHVybiBmX291dH1cblxuXG5mdW5jdGlvbiBhb190YXAoaXRlcmFibGUsIG9yZGVyPTEpIHtcbiAgbGV0IGZfdGFwID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBhZ190YXAgPSBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCwgb3JkZXIpO1xuICBhZ190YXAuZl9vdXQgPSBmX3RhcDtcbiAgYWdfdGFwLmdfaW4gPSBmX3RhcC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIFtmX3RhcCwgYWdfdGFwXX1cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fdGFwKGl0ZXJhYmxlLCBnX3RhcCwgb3JkZXI9MSkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGlmICgwID49IG9yZGVyKSB7YXdhaXQgZ190YXAubmV4dCh2KTt9XG4gICAgICB5aWVsZCB2O1xuICAgICAgaWYgKDAgPD0gb3JkZXIpIHthd2FpdCBnX3RhcC5uZXh0KHYpO30gfSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnX3RhcC5yZXR1cm4oKTt9IH1cblxuY29uc3QgYW9fZmVuY2VfaW4gPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaV9cblxuLCBhb19waXBlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KSB9XG4sIGFvX3F1ZXVlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KSB9XG5cbiwgYW9nX2l0ZXIoeGYpIHtyZXR1cm4gYW9nX2l0ZXIodGhpcyl9XG4sIGFvZ19zaW5rKGZfZ2F0ZSwgeGYpIHtyZXR1cm4gYW9nX3NpbmsodGhpcywgZl9nYXRlLCB4Zil9XG5cblxuLCBhb194Zm9ybV90YXAobnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3RhcChcbiAgICAgIHRoaXMuYW9feGZvcm1fcmF3KG5zX2dlbikpIH1cblxuLCBhb194Zm9ybV9ydW4obnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3NwbGl0KFxuICAgICAgdGhpcy5hb194Zm9ybV9yYXcobnNfZ2VuKSkgfVxuXG4sIGFvX3hmb3JtX3Jhdyhuc19nZW49YW9nX3NpbmspIHtcbiAgICBsZXQge3hpbml0LCB4cmVjdiwgeGVtaXR9ID0gbnNfZ2VuO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHhpbml0KSB7XG4gICAgICB4aW5pdCA9IGlzX2FvX2ZuKG5zX2dlbikgPyBuc19nZW4gOiBhb2dfc2luazt9XG5cblxuICAgIGxldCBhZ19vdXQsIGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSByZXMuZ19pbikge1xuICAgICAgLy8gcmVzIGlzIGFuIG91dHB1dCBnZW5lcmF0b3JcbiAgICAgIGFnX291dCA9IHJlcztcbiAgICAgIGZfb3V0LmdfaW4gPSByZXMuZ19pbjt9XG5cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIHJlcy5uZXh0KCk7XG5cbiAgICAgIGFnX291dCA9IGZfb3V0LmFvX2dhdGVkKHRoaXMpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBmX291dC5nX2luID0gcmVzO1xuICAgICAgYWdfb3V0LmZfb3V0ID0gZl9vdXQ7fVxuXG5cbiAgICBpZiAoeGVtaXQpIHtcbiAgICAgIGxldCB7Z19pbn0gPSBhZ19vdXQ7XG4gICAgICBhZ19vdXQgPSB4ZW1pdChhZ19vdXQpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBnX2luO31cblxuICAgIHJldHVybiBhZ19vdXR9IH0gKTtcblxuXG5cbmZ1bmN0aW9uICogYW9nX2l0ZXIoZywgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0geGYubmV4dCh0aXApLnZhbHVlO31cbiAgICAgIGcubmV4dCh0aXApO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lJDEoZXJyKTt9XG4gIGZpbmFsbHkge1xuICAgIGcucmV0dXJuKCk7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgIHhmLnJldHVybigpO30gfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb2dfc2luayhnLCBmX2dhdGUsIHhmKSB7XG4gIHhmID0geGYgPyBfeGZfZ2VuLmNyZWF0ZSh4ZikgOiB2b2lkIHhmO1xuICB0cnkge1xuICAgIHdoaWxlICgxKSB7XG4gICAgICAge1xuICAgICAgICBsZXQgdGlwID0geWllbGQ7XG4gICAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICAgICAgdGlwID0gYXdhaXQgeGYubmV4dCh0aXApO1xuICAgICAgICAgIHRpcCA9IHRpcC52YWx1ZTt9XG4gICAgICAgIGF3YWl0IGcubmV4dCh0aXApO31cblxuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZl9nYXRlKSB7XG4gICAgICAgIGF3YWl0IGZfZ2F0ZS5mZW5jZSgpO30gfSB9XG5cbiAgY2F0Y2ggKGVycikge1xuICAgIGFvX2NoZWNrX2RvbmUkMShlcnIpO31cbiAgZmluYWxseSB7XG4gICAgZy5yZXR1cm4oKTtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgeGYucmV0dXJuKCk7fSB9IH1cblxuXG5jb25zdCBfeGZfZ2VuID17XG4gIGNyZWF0ZSh4Zikge1xuICAgIGxldCBzZWxmID0ge19fcHJvdG9fXzogdGhpc307XG4gICAgc2VsZi54ZyA9IHhmKHNlbGYueGZfaW52KCkpO1xuICAgIHJldHVybiBzZWxmfVxuXG4sICp4Zl9pbnYoKSB7XG4gICAgd2hpbGUgKDEpIHtcbiAgICAgIGxldCB0aXAgPSB0aGlzLl90aXA7XG4gICAgICBpZiAodGhpcyA9PT0gdGlwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5kZXJmbG93Jyl9XG4gICAgICBlbHNlIHRoaXMuX3RpcCA9IHRoaXM7XG5cbiAgICAgIHlpZWxkIHRpcDt9IH1cblxuLCBuZXh0KHYpIHtcbiAgICB0aGlzLl90aXAgPSB2O1xuICAgIHJldHVybiB0aGlzLnhnLm5leHQodil9XG5cbiwgcmV0dXJuKCkge3RoaXMueGcucmV0dXJuKCk7fVxuLCB0aHJvdygpIHt0aGlzLnhnLnRocm93KCk7fSB9O1xuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwKSB7XG4gIGxldCBbX2ZlbmNlLCBfcmVzdW1lLCBfYWJvcnRdID0gYW9fZmVuY2VfZm4oKTtcbiAgbGV0IHRpZCA9IHNldEludGVydmFsKF9yZXN1bWUsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7XG4gICAgX2Fib3J0KCk7fSk7XG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgbGV0IHA7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgaWYgKF9mZW5jZS5kb25lKSB7cmV0dXJufVxuICAgICAgcCA9IF9mZW5jZSgpO1xuICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7fVxuXG4gICAgYXdhaXQgcDtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7fSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcbiAgcmV0dXJuIHJhZlxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc3VtZSk7XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cbmNvbnN0IF9ldnRfaW5pdCA9IFByb21pc2UucmVzb2x2ZSh7dHlwZTonaW5pdCd9KTtcbmZ1bmN0aW9uIGFvX2RvbV9saXN0ZW4ocGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKSkge1xuICBsZXQgd2l0aF9kb20gPSAoZG9tLCBmbikgPT5cbiAgICBkb20uYWRkRXZlbnRMaXN0ZW5lclxuICAgICAgPyBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pXG4gICAgICA6IF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBkb20pO1xuXG4gIF9iaW5kLnNlbGYgPSB7cGlwZSwgd2l0aF9kb219O1xuICBwaXBlLndpdGhfZG9tID0gd2l0aF9kb207XG4gIHJldHVybiBwaXBlXG5cbiAgZnVuY3Rpb24gX2JpbmQoZG9tLCBmbl9ldnQsIGZuX2RvbSkge1xuICAgIHJldHVybiBldnQgPT4ge1xuICAgICAgbGV0IHYgPSBmbl9ldnRcbiAgICAgICAgPyBmbl9ldnQoZXZ0LCBkb20sIGZuX2RvbSlcbiAgICAgICAgOiBmbl9kb20oZG9tLCBldnQpO1xuXG4gICAgICBpZiAobnVsbCAhPSB2KSB7XG4gICAgICAgIHBpcGUuZ19pbi5uZXh0KHYpO30gfSB9IH1cblxuXG5mdW5jdGlvbiBfYW9fd2l0aF9kb20oX2JpbmQsIGZuLCBkb20pIHtcbiAgbGV0IF9vbl9ldnQ7XG4gIGlmIChpc19hb19mbihmbikpIHtcbiAgICBfZXZ0X2luaXQudGhlbihcbiAgICAgIF9vbl9ldnQgPSBfYmluZChkb20sIHZvaWQgMCwgZm4pKTsgfVxuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGxldCBvcHQsIGV2dF9mbiA9IF9vbl9ldnQ7XG5cbiAgICAgIGxldCBsYXN0ID0gYXJncy5wb3AoKTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBldnRfZm4gPSBfYmluZChkb20sIGxhc3QsIF9vbl9ldnQpO1xuICAgICAgICBsYXN0ID0gYXJncy5wb3AoKTt9XG5cbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgYXJncy5wdXNoKGxhc3QpO31cbiAgICAgIGVsc2Ugb3B0ID0gbGFzdDtcblxuICAgICAgZm9yIChsZXQgZXZ0IG9mIGFyZ3MpIHtcbiAgICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgZXZ0LCBldnRfZm4sIG9wdCk7IH1cblxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBlY3R4X2xpc3QpIHtcbiAgZWN0eF9saXN0ID0gQXJyYXkuZnJvbShlY3R4X2xpc3QsXG4gICAgZG9tID0+IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkpO1xuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGZvciAobGV0IGVjdHggb2YgZWN0eF9saXN0KSB7XG4gICAgICAgIGVjdHgubGlzdGVuKC4uLmFyZ3MpO31cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuZXhwb3J0IHsgX2FvX2ZlbmNlX2FwaV8sIF9hb190YXAsIF94Zl9nZW4sIGFvX2NoZWNrX2RvbmUkMSBhcyBhb19jaGVja19kb25lLCBhb19kZWJvdW5jZSwgYW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3YsIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9saXN0ZW4sIGFvX2RvbmUsIGFvX2RyaXZlLCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfaW4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfdiwgYW9faW50ZXJ2YWwsIGFvX2l0ZXIsIGFvX3J1biwgYW9fc3BsaXQsIGFvX3N0ZXBfaXRlciwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9nX2l0ZXIsIGFvZ19zaW5rLCBmbl9jaGFpbiwgaXNfYW9fZm4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29iaiwgYW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcnJlZCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRcbiAgICBpc19mbiBAIGFvX2RlZmVycmVkX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfaW5cblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4iLCJpbXBvcnQge2FvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19kZWZlcnJlZCcsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVycmVkX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWRfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWQgb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5wcm9taXNlKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMucmVzb2x2ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZWplY3QpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlJywgQDo6XG5cbiAgaXQgQCAnYW9fcnVuJywgQDo6PlxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19ydW4oZylcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICBpdCBAICdhb19kcml2ZSBnZW5lcmF0b3InLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGdfdGd0ID0gZ2VuX3Rlc3QobHN0KVxuICAgIGdfdGd0Lm5leHQoJ2ZpcnN0JylcbiAgICBnX3RndC5uZXh0KCdzZWNvbmQnKVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdfdGd0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgMTk0MlxuICAgICAgMjA0MlxuICAgICAgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdFxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBpdCBAICdhb19zcGxpdCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy53aGVuX3J1bikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3Mud2hlbl9ydW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgaXQgQCAnYW9fdGFwIHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgW2Zfb3V0LCBhZ190YXBdID0gYW9fdGFwKGcpXG4gICAgICBpc19hc3luY19pdGVyYWJsZSBAIGZfb3V0XG4gICAgICBpc19nZW4gQCBhZ190YXBcblxuICAgICAgZXhwZWN0KGZfb3V0LmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZl9vdXQuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dC5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihmX291dClcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFnX3RhcClcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBkZWxheV9yYWNlfSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICBsZXQgZlxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICBmID0gZmVuY2UoKVxuICAgIHJlc3VtZSBAICd0d28nXG4gICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3R3bycsIGF3YWl0IGZcblxuICAgIHJlc3VtZSBAICdmb3VyJ1xuICAgIHJlc3VtZSBAICdmaXZlJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3NpeCdcbiAgICByZXN1bWUgQCAnc2V2ZW4nXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAnc2l4JywgYXdhaXQgZlxuXG5cbiAgaXQgQCAnbmV2ZXIgYmxvY2tlZCBvbiBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIHJlc3VtZSBAICdvbmUnXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cblxuICBpdCBAICdleGVyY2lzZSBmZW5jZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgIGxldCB2ID0gJ2EnXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdhJylcblxuICAgIGNvbnN0IHAgPSBAIT5cbiAgICAgIHYgPSAnYidcblxuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2JiJylcblxuICAgICAgdiA9ICdjJ1xuICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgZXhwZWN0KGFucykudG8uZXF1YWwoJ2NjJylcbiAgICAgIHYgPSAnZCdcbiAgICAgIHJldHVybiAxOTQyXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG5cbiAgICA6OlxuICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdkJylcblxuIiwiaW1wb3J0IHthb19mZW5jZV9mbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YXNzZXJ0LCBleHBlY3QsIGlzX2ZlbmNlX2Jhc2ljLCBkZWxheV9yYWNlLCBkZWxheX0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2ZuJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXNfZmVuY2VfYmFzaWMocmVzWzBdKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGNvbnN0IHAgPSBmZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX2ZuKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSBmZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7YXNzZXJ0LCBleHBlY3QsIGlzX2ZlbmNlX2Z1bGwsIGRlbGF5X3JhY2UsIGRlbGF5fSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2Vfb2JqJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGlzX2ZlbmNlX2Z1bGwgQCBhb19mZW5jZV9vYmooKVxuICAgIGV4cGVjdChyZXMuYW9fZ2F0ZWQpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXN1bWUoJ3JlYWR5JylcblxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgIGJyZWFrXG5cblxuICBpdCBAICdhc3luYyBpdGVyIG11bHRpIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2lufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthc3NlcnQsIGV4cGVjdCwgaXNfZmVuY2VfZnVsbCwgZGVsYXlfcmFjZSwgZGVsYXl9IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbicsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGlzX2ZlbmNlX2Z1bGwgQCBhb19mZW5jZV9pbigpXG5cbiAgICBleHBlY3QocmVzLmFvX3hmb3JtX3RhcCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9feGZvcm1fcnVuKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybV9yYXcpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGV4cGVjdChyZXMuYW9fcXVldWUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19zaW5rKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBleHBlY3QocmVzLmFvX3BpcGUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvZ19pdGVyKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgY29uc3QgcCA9IHJlcy5mZW5jZSgpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIHJlcy5yZXN1bWUoMTk0MilcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzLnJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2luKClcblxuICAgIGxldCBwYSA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICBsZXQgcGIgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IHJlcy5mZW5jZSgpXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgIHJlcy5yZXN1bWUoJ3JlYWR5JylcbiAgICBhc3NlcnQuZXF1YWwgQCAncGEgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbiwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGRlbGF5X3dhbGssIGFycmF5X2Zyb21fYW9faXRlcixcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbi5hb19xdWV1ZScsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9xdWV1ZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fcXVldWUoKVxuXG4gICAgaXNfZ2VuKHNvbWVfcXVldWUuZ19pbilcbiAgICBleHBlY3Qoc29tZV9xdWV1ZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICBpdCBAICdzaW5nbGVzJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBsZXQgcF9vdXQxID0gc29tZV9xdWV1ZS5mZW5jZSgpXG4gICAgZXhwZWN0KHBfb3V0MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQgcF9pbjEgPSBzb21lX3F1ZXVlLmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZXF1YWwgQCAnZmlyc3QnXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBzb21lX3F1ZXVlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSBAOlxuICAgICAgYXN5bmMgKiB4cmVjdihnKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHlpZWxkIDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3F1ZXVlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2FsayBAIyAyNSwgNTAsIDc1LCAxMDBcbiAgICAgIHNvbWVfcXVldWUuZ19pblxuXG4gICAgYXdhaXQgc29tZV9xdWV1ZS5nX2luLnJldHVybigpXG5cbiAgICBleHBlY3QoYXdhaXQgb3V0KS50by5kZWVwLmVxdWFsIEAjXG4gICAgICAxMDI1LCAxMDUwLCAxMDc1LCAxMTAwXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4uYW9fcGlwZSBiYXNpY3MnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHNvbWVfcGlwZSA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ZlbmNlX2luKCkuYW9fcGlwZSgpXG5cbiAgICBpc19nZW4gQCBzb21lX3BpcGUuZ19pblxuICAgIGV4cGVjdChzb21lX3BpcGUuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3Qoc29tZV9waXBlLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICBpdCBAICdleGFtcGxlJywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3BpcGUoKVxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cbiAgaXQgQCAneGZvbGQnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcGlwZSBAOlxuICAgICAgKnhyZWN2KGcpIDo6XG4gICAgICAgIGxldCBzID0gMFxuICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgIHMgKz0gdlxuICAgICAgICAgIHlpZWxkIHNcblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDE5NDIrMjA0MiwgMTk0MisyMDQyKzIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4ZW1pdCcsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19waXBlIEA6XG4gICAgICBhc3luYyAqIHhlbWl0KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgWyd4ZScsIHZdXG5cbiAgICBsZXQgeiA9IF90ZXN0X3BpcGVfb3V0IEAgc29tZV9waXBlLFxuICAgICAgWzE5NDIsIDIwNDIsIDIxNDJdXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXSBbJ3hlJywgMTk0Ml1cbiAgICAgICAgICBbJ3hlJywgMjA0Ml1cbiAgICAgICAgICBbJ3hlJywgMjE0Ml1cbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBhc3luYyBmdW5jdGlvbiBfdGVzdF9waXBlX291dChzb21lX3BpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICByZXR1cm4gelxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZSwgYW9fcnVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luLmFvX3BpcGUgYWR2YW5jZWQnLCBmdW5jdGlvbigpIDo6XG4gIGRlc2NyaWJlIEAgJ2NvbXB1dGUnLCBAOjpcbiAgICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3BpcGUgQDpcbiAgICAgICAgKnhyZWN2KGcpIDo6XG4gICAgICAgICAgZm9yIGxldCB2IG9mIGcgOjpcbiAgICAgICAgICAgIHlpZWxkIHYgKyAxMDAwXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMTAzMCwgMTAyMCwgMTAxMFxuXG5cbiAgICBpdCBAICcqeGdmb2xkJywgQDo6PlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcGlwZSBAOlxuICAgICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgICBsZXQgcyA9IDBcbiAgICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgICAgcyArPSB2ICsgMTAwMFxuICAgICAgICAgICAgeWllbGQgc1xuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICBzb21lX3BpcGUuZ19pbiwgdHJ1ZVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDEwMzAsIDIwNTAsIDMwNjBcblxuXG4gICAgaXQgQCAneGN0eCcsIEA6Oj5cbiAgICAgIGxldCBsb2c9W11cblxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcGlwZSBAOlxuICAgICAgICAqeGluaXQoZ19pbikgOjpcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgICAgdHJ5IDo6XG4gICAgICAgICAgICB5aWVsZCAqIGdfaW4uYW9nX2l0ZXIoKVxuICAgICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aWQpXG4gICAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IGZpbidcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnXG5cbiAgICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgICBzb21lX3BpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnLCAneGN0eCBmaW4nXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgZGVzY3JpYmUgQCAnb3V0cHV0IGFzeW5jIGdlbmVyYXRvcicsIEA6OlxuICAgIGl0IEAgJ3JhdycsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2dlbiBAXG4gICAgICAgIGFvX2ZlbmNlX2luKCkuYW9feGZvcm1fcmF3KClcblxuICAgICAgbGV0IHYwID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcGQgPSBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgZ3MuZ19pbiwgdHJ1ZVxuXG4gICAgICBsZXQgcHIgPSBhb19ydW4oZ3MpXG4gICAgICBleHBlY3QocHIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHByKS50by5iZS51bmRlZmluZWRcbiAgICAgIGV4cGVjdChhd2FpdCBwZCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICAgIGxldCB2MSA9IGdzLm5leHQoKVxuICAgICAgZXhwZWN0KHYxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGF3YWl0IHYwKS50by5kZWVwLmVxdWFsIEA6IHZhbHVlOiAzMCwgZG9uZTogZmFsc2VcbiAgICAgIGV4cGVjdChhd2FpdCB2MSkudG8uZGVlcC5lcXVhbCBAOiB2YWx1ZTogdW5kZWZpbmVkLCBkb25lOiB0cnVlXG5cblxuICAgIGl0IEAgJ3RhcCcsIEA6Oj5cbiAgICAgIGxldCBbZl90YXAsIGFnX3RhcF0gPSBhb19mZW5jZV9pbigpLmFvX3hmb3JtX3RhcCgpXG5cbiAgICAgIGlzX2FzeW5jX2l0ZXJhYmxlKGZfdGFwKVxuICAgICAgaXNfZ2VuKGFnX3RhcClcbiAgICAgIGlzX2dlbihmX3RhcC5nX2luKVxuICAgICAgaXNfZ2VuKGFnX3RhcC5nX2luKVxuICAgICAgYXNzZXJ0IEAgZl90YXAuZ19pbiA9PT0gYWdfdGFwLmdfaW4sIFwiaGFzIHNhbWUgZ19pblwiXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfdGFwLmFvX2ZvcmsoKSlcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfdGFwLmFvX2ZvcmsoKSlcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl90YXApXG4gICAgICBleHBlY3QoZl90YXAuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgIGZfdGFwLmdfaW4sIHRydWVcblxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHopLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhd2FpdCBhb19ydW4oYWdfdGFwKVxuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYSkudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG5cblxuICAgIGl0IEAgJ3NwbGl0JywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19mZW5jZV9pbigpLmFvX3hmb3JtX3J1bigpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG5cbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KGdzLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHopLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgZ3MuZ19pbiwgdHJ1ZVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5lcXVhbCBAIDMwXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBhKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBiKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ3RpbWUnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ludGVydmFsXG4gICAgaXNfZm4gQCBhb190aW1lb3V0XG4gICAgaXNfZm4gQCBhb190aW1lc1xuXG5cbiAgaXQgQCAnYW9faW50ZXJ2YWwnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ludGVydmFsKDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb190aW1lb3V0JywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb190aW1lb3V0KDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb19kZWJvdW5jZScsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZGVib3VuY2UoMTAsIFszMCwgMjAsIDEwLCAxNV0pXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIGV4cGVjdChhb3QuZmluKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LmZpblxuXG5cbiAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2ludGVydmFsKDEwKVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9hbmltYXRpb24sIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBhbmltYXRpb24gZnJhbWVzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fYW5pbWF0aW9uXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgOjpcblxuICAgIGl0IEAgJ2FvX2RvbV9hbmltYXRpb24nLCBAOjo+XG4gICAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19kb21fYW5pbWF0aW9uKClcbiAgICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHZhbHVlID49IDApXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuXG4gICAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9fZG9tX2FuaW1hdGlvbigpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2xpc3Rlbn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXksXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGFycmF5X2Zyb21fYW9faXRlclxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBldmVudHMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9saXN0ZW5cblxuICAgIGxldCBkZSA9IGlzX2dlbiBAIGFvX2RvbV9saXN0ZW4oKVxuICAgIGlzX2dlbiBAIGRlLmdfaW5cbiAgICBpc19mbiBAIGRlLndpdGhfZG9tXG5cblxuICBpdCBAICdzaGFwZSBvZiB3aXRoX2RvbScsIEA6OlxuICAgIGxldCBtb2NrID0gQHt9XG4gICAgICBhZGRFdmVudExpc3RlbmVyKGV2dCwgZm4sIG9wdCkgOjpcblxuICAgIGxldCBlX2N0eCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgLndpdGhfZG9tKG1vY2spXG5cbiAgICBpc19mbiBAIGVfY3R4LndpdGhfZG9tXG4gICAgaXNfZm4gQCBlX2N0eC5saXN0ZW5cblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgOjpcblxuICAgIGl0IEAgJ21lc3NhZ2UgY2hhbm5lbHMnLCBAOjo+XG4gICAgICBjb25zdCB7cG9ydDEsIHBvcnQyfSA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpXG5cbiAgICAgIGNvbnN0IGFvX3RndCA9IGFvX2RvbV9saXN0ZW4oKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYW9fdGd0KVxuXG4gICAgICBhb190Z3RcbiAgICAgICAgLndpdGhfZG9tIEAgcG9ydDIsIHZvaWQgcG9ydDIuc3RhcnQoKVxuICAgICAgICAubGlzdGVuIEAgJ21lc3NhZ2UnLCBldnQgPT4gQDogdGVzdF9uYW1lOiBldnQuZGF0YVxuXG4gICAgICA6OiE+XG4gICAgICAgIGZvciBsZXQgbSBvZiBbJ2EnLCAnYicsICdjJ10gOjpcbiAgICAgICAgICBwb3J0MS5wb3N0TWVzc2FnZSBAIGBmcm9tIG1zZyBwb3J0MTogJHttfWBcbiAgICAgICAgICBhd2FpdCBkZWxheSgxKVxuXG4gICAgICAgIGFvX3RndC5nX2luLnJldHVybigpXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGEnXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYidcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztFQUFBLG1DQUFtQyxNQUFNOzs7SUFJdkMsWUFBYTtNQUNYLFdBQVksT0FBUTs7O0lBR3RCLGNBQWU7OztJQUdmO2VBQ1M7TUFDUDtNQUNBOzs7SUFHRixtQkFBbUIsVUFBVTtJQUM3Qjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTtJQUNBOzs7SUFHQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOztJQUVBO0lBQ0E7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ3JERixNQUFNLFVBQVUsR0FBRyxDQUFDO0VBQ3BCLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDbEM7RUFDQSxNQUFNLFFBQVEsR0FBRyxJQUFJO0VBQ3JCLEVBQUUsVUFBVSxLQUFLLE9BQU8sSUFBSTtFQUM1QixPQUFPLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCO0FBQ0E7RUFDQSxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDL0MsTUFBTSxlQUFlLEdBQUcsR0FBRyxJQUFJO0VBQy9CLEVBQUUsSUFBSSxHQUFHLEtBQUssT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7RUFDOUMsSUFBSSxNQUFNLEdBQUcsQ0FBQztFQUNkLEVBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQztBQUNmO0FBQ0E7RUFDQSxXQUFXLElBQUksQ0FBQyxNQUFNLEVBQUU7RUFDeEIsRUFBRSxRQUFRLE1BQU0sQ0FBQyxDQUFDO0VBQ2xCLGlCQUFpQixPQUFPLENBQUMsTUFBTSxFQUFFO0VBQ2pDLEVBQUUsUUFBUSxNQUFNLENBQUMsQ0FBQztBQUNsQjtBQUNBO0VBQ0EsU0FBUyxRQUFRLENBQUMsSUFBSSxFQUFFO0VBQ3hCLEVBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7RUFDcEIsRUFBRSxPQUFPLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSztFQUM1QixFQUFFLFNBQVMsS0FBSyxDQUFDLEVBQUUsRUFBRTtFQUNyQixJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUNoQyxJQUFJLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDbkI7RUFDQSxNQUFNLGFBQWEsSUFBSSxDQUFDLE1BQU07RUFDOUIsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7RUFDekMsRUFBRSxPQUFPLENBQUM7RUFDVixJQUFJLENBQUMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7RUFDMUIsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNyQjtFQUNBLE1BQU0sV0FBVyxHQUFHLENBQUM7RUFDckIsRUFBRSxDQUFDLEdBQUcsYUFBYSxFQUFFO0VBQ3JCLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEQ7RUFDQSxlQUFlLE1BQU0sQ0FBQyxNQUFNLEVBQUU7RUFDOUIsRUFBRSxXQUFXLElBQUksQ0FBQyxJQUFJLE1BQU0sRUFBRSxFQUFFLEVBQUU7QUFDbEM7QUFDQTtFQUNBLGVBQWUsUUFBUSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFO0VBQ3BELEVBQUUsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7RUFDekIsSUFBSSxPQUFPLEdBQUcsT0FBTyxFQUFFLENBQUM7RUFDeEIsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNwQjtFQUNBLEVBQUUsV0FBVyxJQUFJLENBQUMsSUFBSSxNQUFNLEVBQUU7RUFDOUIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ3ZDLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUN2QjtFQUNBLEVBQUUsSUFBSSxTQUFTLEVBQUU7RUFDakIsSUFBSSxNQUFNLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDOUI7QUFDQTtFQUNBLFNBQVMsWUFBWSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUU7RUFDekMsRUFBRSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0VBQy9CLEVBQUUsT0FBTztFQUNULElBQUksU0FBUyxNQUFNLENBQUMsYUFBYSxDQUFDLEdBQUc7RUFDckMsTUFBTSxHQUFHO0VBQ1QsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO0VBQ2xELFFBQVEsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEtBQUssQ0FBQztFQUNoQyxRQUFRLE1BQU0sS0FBSyxDQUFDLENBQUM7RUFDckIsYUFBYSxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUU7QUFDM0I7QUFDQTtFQUNBLFNBQVMsU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUU7RUFDdEMsRUFBRSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0VBQzVCLEVBQUUsT0FBTztFQUNULElBQUksRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUc7RUFDekIsTUFBTSxHQUFHO0VBQ1QsUUFBUSxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztFQUM1QyxRQUFRLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLENBQUM7RUFDaEMsUUFBUSxNQUFNLEtBQUssQ0FBQyxDQUFDO0VBQ3JCLGFBQWEsT0FBTyxDQUFDLEVBQUUsRUFBRSxFQUFFO0FBQzNCO0VBQ0EsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFO0VBQzNCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0VBQ3pDLEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlDO0VBQ0EsRUFBRSxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQ3hELEVBQUUsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUMzQyxFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pEO0VBQ0EsRUFBRSxPQUFPLEtBQUs7RUFDZCxLQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQztFQUM3QyxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRTtBQUM3QjtBQUNBO0FBQ0E7RUFDQSxNQUFNLGNBQWMsRUFBRTtFQUN0QixFQUFFLFNBQVMsQ0FBQztFQUNaO0VBQ0EsSUFBSSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztFQUN4RCxJQUFJLE1BQU0sR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDOUQsSUFBSSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM1RDtFQUNBLElBQUksYUFBYSxFQUFFLGVBQWU7RUFDbEMsSUFBSSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUMzQztFQUNBO0FBQ0E7RUFDQSxFQUFFLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxHQUFHO0VBQzNCLElBQUksT0FBTyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDMUI7RUFDQSxFQUFFLFFBQVEsT0FBTyxHQUFHO0VBQ3BCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztFQUN2QixJQUFJLElBQUk7RUFDUixNQUFNLE9BQU8sQ0FBQyxFQUFFO0VBQ2hCLFFBQVEsTUFBTSxNQUFNLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRTtFQUMvQixJQUFJLE9BQU8sR0FBRyxFQUFFO0VBQ2hCLE1BQU0sZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7QUFDakM7QUFDQTtFQUNBLFNBQVMsV0FBVyxDQUFDLEdBQUcsRUFBRTtFQUMxQixFQUFFLElBQUksQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDO0VBQ3ZCLEVBQUUsSUFBSSxTQUFTLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ3RDLEVBQUUsR0FBRyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQztFQUNqRCxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ1g7QUFDQTtFQUNBLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0VBQzFDLEVBQUUsU0FBUyxFQUFFLGNBQWM7QUFDM0I7RUFDQSxFQUFFLFFBQVEsUUFBUSxDQUFDLE1BQU0sRUFBRTtFQUMzQixJQUFJLElBQUk7RUFDUixNQUFNLE9BQU8sQ0FBQyxFQUFFO0VBQ2hCLFFBQVEsSUFBSSxDQUFDLEdBQUcsTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7RUFDckMsUUFBUSxNQUFNLENBQUMsQ0FBQztFQUNoQixRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0VBQzFCLElBQUksT0FBTyxHQUFHLEVBQUU7RUFDaEIsTUFBTSxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUM1QixZQUFZO0VBQ1osTUFBTSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7RUFDckIsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDO0FBQzNCO0VBQ0EsU0FBUyxRQUFRLENBQUMsTUFBTSxFQUFFO0VBQzFCLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQztFQUN2QixFQUFFLElBQUksU0FBUyxLQUFLLEtBQUssRUFBRTtFQUMzQixJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ3RDO0VBQ0EsRUFBRSxLQUFLLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztFQUNsQyxFQUFFLE9BQU8sS0FBSyxDQUFDO0FBQ2Y7QUFDQTtFQUNBLFNBQVMsTUFBTSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFO0VBQ25DLEVBQUUsSUFBSSxLQUFLLEdBQUcsWUFBWSxFQUFFLENBQUM7RUFDN0IsRUFBRSxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztFQUMvQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0VBQ3ZCLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7RUFDM0MsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3pCO0VBQ0EsaUJBQWlCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUU7RUFDbkQsRUFBRSxJQUFJO0VBQ04sSUFBSSxXQUFXLElBQUksQ0FBQyxJQUFJLFFBQVEsRUFBRTtFQUNsQyxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQzVDLE1BQU0sTUFBTSxDQUFDLENBQUM7RUFDZCxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtFQUNoRCxFQUFFLE9BQU8sR0FBRyxFQUFFO0VBQ2QsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUN4QixVQUFVO0VBQ1YsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ3RCO0VBQ0EsTUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDekMsRUFBRSxTQUFTLEVBQUUsY0FBYztBQUMzQjtFQUNBLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRTtFQUNsQixJQUFJLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztFQUM3QixNQUFNLEtBQUssRUFBRSxRQUFRLEVBQUUsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFO0VBQ3JDLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRTtFQUNuQixJQUFJLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQztFQUM3QixNQUFNLEtBQUssRUFBRSxRQUFRLEVBQUUsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFO0FBQ3JDO0VBQ0EsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEMsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDLE9BQU8sUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDMUQ7QUFDQTtFQUNBLEVBQUUsWUFBWSxDQUFDLE1BQU0sRUFBRTtFQUN2QixJQUFJLE9BQU8sTUFBTTtFQUNqQixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtBQUNsQztFQUNBLEVBQUUsWUFBWSxDQUFDLE1BQU0sRUFBRTtFQUN2QixJQUFJLE9BQU8sUUFBUTtFQUNuQixNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtBQUNsQztFQUNBLEVBQUUsWUFBWSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7RUFDaEMsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLENBQUM7RUFDdkMsSUFBSSxJQUFJLFNBQVMsS0FBSyxLQUFLLEVBQUU7RUFDN0IsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sR0FBRyxRQUFRLENBQUMsQ0FBQztBQUNwRDtBQUNBO0VBQ0EsSUFBSSxJQUFJLE1BQU0sRUFBRSxLQUFLLEdBQUcsWUFBWSxFQUFFLENBQUM7RUFDdkMsSUFBSSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN4QztFQUNBLElBQUksSUFBSSxTQUFTLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRTtFQUNoQztFQUNBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQztFQUNuQixNQUFNLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdCO0VBQ0EsU0FBUztFQUNUO0VBQ0EsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDakI7RUFDQSxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0VBQ3BDLE1BQU0sTUFBTSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztFQUNyQyxNQUFNLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFDNUI7QUFDQTtFQUNBLElBQUksSUFBSSxLQUFLLEVBQUU7RUFDZixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUM7RUFDMUIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQzdCLE1BQU0sTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztBQUMxQjtFQUNBLElBQUksT0FBTyxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUM7QUFDdkI7QUFDQTtBQUNBO0VBQ0EsV0FBVyxRQUFRLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUU7RUFDbkMsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUM7RUFDekMsRUFBRSxJQUFJO0VBQ04sSUFBSSxPQUFPLENBQUMsRUFBRTtFQUNkLE1BQU0sSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDO0VBQ3RCLE1BQU0sSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFO0VBQzVCLFFBQVEsR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDbEMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNyQjtFQUNBLEVBQUUsT0FBTyxHQUFHLEVBQUU7RUFDZCxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQzFCLFVBQVU7RUFDVixJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztFQUNmLElBQUksSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFO0VBQzFCLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3ZCO0FBQ0E7RUFDQSxpQkFBaUIsUUFBUSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0VBQ3pDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDO0VBQ3pDLEVBQUUsSUFBSTtFQUNOLElBQUksT0FBTyxDQUFDLEVBQUU7RUFDZCxPQUFPO0VBQ1AsUUFBUSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7RUFDeEIsUUFBUSxJQUFJLFNBQVMsS0FBSyxFQUFFLEVBQUU7RUFDOUIsVUFBVSxHQUFHLEdBQUcsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ25DLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUMzQixRQUFRLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNCO0VBQ0EsTUFBTSxJQUFJLFNBQVMsS0FBSyxNQUFNLEVBQUU7RUFDaEMsUUFBUSxNQUFNLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNsQztFQUNBLEVBQUUsT0FBTyxHQUFHLEVBQUU7RUFDZCxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0VBQzFCLFVBQVU7RUFDVixJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztFQUNmLElBQUksSUFBSSxTQUFTLEtBQUssRUFBRSxFQUFFO0VBQzFCLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3ZCO0FBQ0E7RUFDQSxNQUFNLE9BQU8sRUFBRTtFQUNmLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRTtFQUNiLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDakMsSUFBSSxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztFQUNoQyxJQUFJLE9BQU8sSUFBSSxDQUFDO0FBQ2hCO0VBQ0EsRUFBRSxDQUFDLE1BQU0sR0FBRztFQUNaLElBQUksT0FBTyxDQUFDLEVBQUU7RUFDZCxNQUFNLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDMUIsTUFBTSxJQUFJLElBQUksS0FBSyxHQUFHLEVBQUU7RUFDeEIsUUFBUSxNQUFNLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0VBQ3JDLFdBQVcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDNUI7RUFDQSxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRTtBQUNuQjtFQUNBLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtFQUNWLElBQUksSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7RUFDbEIsSUFBSSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzNCO0VBQ0EsRUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7RUFDOUIsRUFBRSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQy9CO0VBQ0EsU0FBUyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRTtFQUM5QixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxHQUFHLFdBQVcsRUFBRSxDQUFDO0VBQ2hELEVBQUUsSUFBSSxHQUFHLEdBQUcsV0FBVyxDQUFDLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFDeEMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztFQUMvQixFQUFFLE1BQU0sQ0FBQyxJQUFJLElBQUksTUFBTTtFQUN2QixJQUFJLEdBQUcsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDN0IsSUFBSSxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztFQUN2QixJQUFJLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2hCLEVBQUUsT0FBTyxNQUFNLENBQUM7QUFDaEI7QUFDQTtFQUNBLFNBQVMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUU7RUFDN0IsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7RUFDcEQsRUFBRSxPQUFPLE9BQU87QUFDaEI7RUFDQSxFQUFFLFNBQVMsT0FBTyxHQUFHO0VBQ3JCLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQ3JDLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7RUFDakMsSUFBSSxPQUFPLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFDdEI7QUFDQTtFQUNBLFNBQVMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFO0VBQ3JDLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUM7QUFDN0M7RUFDQSxFQUFFLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZO0VBQzdCLElBQUksSUFBSSxDQUFDLENBQUM7RUFDVixJQUFJLFdBQVcsSUFBSSxDQUFDLElBQUksTUFBTSxFQUFFO0VBQ2hDLE1BQU0sWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3hCLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO0VBQy9CLE1BQU0sQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDO0VBQ25CLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEM7RUFDQSxJQUFJLE1BQU0sQ0FBQyxDQUFDO0VBQ1osSUFBSSxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzdCO0VBQ0EsRUFBRSxPQUFPLE1BQU0sQ0FBQztBQUNoQjtBQUNBO0VBQ0EsaUJBQWlCLFFBQVEsQ0FBQyxNQUFNLEVBQUU7RUFDbEMsRUFBRSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7RUFDdkIsRUFBRSxXQUFXLElBQUksQ0FBQyxJQUFJLE1BQU0sRUFBRTtFQUM5QixJQUFJLE1BQU0sSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDOUI7RUFDQSxTQUFTLGdCQUFnQixHQUFHO0VBQzVCLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ2hELEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxNQUFNO0VBQ3BCLElBQUksR0FBRyxHQUFHLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQ3BDLElBQUksR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDdkIsRUFBRSxPQUFPLEdBQUc7QUFDWjtFQUNBLEVBQUUsU0FBUyxHQUFHLEdBQUc7RUFDakIsSUFBSSxHQUFHLEdBQUcscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUM7RUFDekMsSUFBSSxPQUFPLE1BQU0sRUFBRSxDQUFDLEVBQUU7QUFDdEI7RUFDQSxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7RUFDakQsU0FBUyxhQUFhLENBQUMsSUFBSSxHQUFHLFdBQVcsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFO0VBQ3hELEVBQUUsSUFBSSxRQUFRLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRTtFQUN6QixJQUFJLEdBQUcsQ0FBQyxnQkFBZ0I7RUFDeEIsUUFBUSxZQUFZLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUM7RUFDcEMsUUFBUSxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3pDO0VBQ0EsRUFBRSxLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0VBQ2hDLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7RUFDM0IsRUFBRSxPQUFPLElBQUk7QUFDYjtFQUNBLEVBQUUsU0FBUyxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7RUFDdEMsSUFBSSxPQUFPLEdBQUcsSUFBSTtFQUNsQixNQUFNLElBQUksQ0FBQyxHQUFHLE1BQU07RUFDcEIsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUM7RUFDbEMsVUFBVSxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzNCO0VBQ0EsTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEVBQUU7RUFDckIsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFO0FBQ2pDO0FBQ0E7RUFDQSxTQUFTLFlBQVksQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRTtFQUN0QyxFQUFFLElBQUksT0FBTyxDQUFDO0VBQ2QsRUFBRSxJQUFJLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRTtFQUNwQixJQUFJLFNBQVMsQ0FBQyxJQUFJO0VBQ2xCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFDO0VBQ0EsRUFBRSxPQUFPO0VBQ1QsSUFBSSxTQUFTLEVBQUUsS0FBSyxDQUFDLElBQUk7RUFDekIsSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLEVBQUU7RUFDcEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxNQUFNLEdBQUcsT0FBTyxDQUFDO0FBQ2hDO0VBQ0EsTUFBTSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7RUFDNUIsTUFBTSxJQUFJLFVBQVUsS0FBSyxPQUFPLElBQUksRUFBRTtFQUN0QyxRQUFRLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztFQUMzQyxRQUFRLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztBQUMzQjtFQUNBLE1BQU0sSUFBSSxRQUFRLEtBQUssT0FBTyxJQUFJLEVBQUU7RUFDcEMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDekIsV0FBVyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ3RCO0VBQ0EsTUFBTSxLQUFLLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtFQUM1QixRQUFRLEdBQUcsQ0FBQyxnQkFBZ0I7RUFDNUIsVUFBVSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDOUI7RUFDQSxNQUFNLE9BQU8sSUFBSSxDQUFDLEVBQUUsRUFBRTtBQUN0QjtBQUNBO0VBQ0EsU0FBUyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRTtFQUNoRCxFQUFFLFNBQVMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVM7RUFDbEMsSUFBSSxHQUFHLElBQUksWUFBWSxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6QztFQUNBLEVBQUUsT0FBTztFQUNULElBQUksU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJO0VBQ3pCLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxFQUFFO0VBQ3BCLE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxTQUFTLEVBQUU7RUFDbEMsUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUM5QixNQUFNLE9BQU8sSUFBSSxDQUFDLEVBQUU7O0VDN1hwQixTQUFVLE9BQVE7SUFDaEIsR0FBSSxVQUFXO01BQ2IsTUFBTztNQUNQLE1BQU87O0lBRVQsR0FBSSxPQUFRO01BQ1YsTUFBTztNQUNQLE1BQU87TUFDUCxNQUFPO01BQ1AsTUFBTzs7SUFFVCxHQUFJLE9BQVE7TUFDVixNQUFPO01BQ1AsTUFBTztNQUNQLE1BQU87TUFDUCxNQUFPOztNQUVQLE1BQU87TUFDUCxNQUFPOztJQUVULEdBQUksT0FBUTtNQUNWLE1BQU87TUFDUCxNQUFPOztFQ3ZCWCxTQUFVLGtCQUFtQjs7SUFFM0IsU0FBVSxxQkFBc0I7TUFDOUIsR0FBSSxPQUFRO1FBQ1Y7UUFDQSxxQkFBcUIsT0FBTztRQUM1Qix1QkFBdUIsU0FBUztRQUNoQyx1QkFBdUIsVUFBVTtRQUNqQyx1QkFBdUIsVUFBVTs7TUFFbkMsR0FBSSxjQUFlO1FBQ2pCOztRQUVBLGFBQWMsU0FBVTs7UUFFeEIsUUFBUSxLQUFLO1FBQ2IsYUFBYyxLQUFNOztNQUV0QixHQUFJLGFBQWM7UUFDaEI7O1FBRUEsYUFBYyxTQUFVOztRQUV4QixPQUFRLFVBQVcsTUFBTTs7UUFFekI7VUFDRTtVQUNBO2VBQ0c7VUFDSCxhQUFjLE1BQU87Ozs7SUFJM0IsU0FBVSxvQkFBcUI7TUFDN0IsR0FBSSxPQUFRO1FBQ1Y7UUFDQSxxQkFBcUIsUUFBUTtRQUM3Qiw0QkFBNEIsU0FBUztRQUNyQyw0QkFBNEIsVUFBVTtRQUN0QywyQkFBMkIsVUFBVTs7TUFFdkMsR0FBSSxjQUFlO1FBQ2pCO1FBQ0E7O1FBRUEsYUFBYyxTQUFVOztRQUV4QixZQUFZLEtBQUs7UUFDakIsYUFBYyxLQUFNOztNQUV0QixHQUFJLGFBQWM7UUFDaEI7UUFDQTs7UUFFQSxhQUFjLFNBQVU7O1FBRXhCLFdBQVksVUFBVyxNQUFNOztRQUU3QjtVQUNFO1VBQ0E7ZUFDRztVQUNILGFBQWMsTUFBTzs7RUM3RDdCLFNBQVUsWUFBYTs7SUFFckIsR0FBSSxRQUFTO01BQ1gsb0JBQXFCO01BQ3JCOztNQUVBLGtCQUFrQixTQUFTO01BQzNCLGlCQUFrQjs7SUFFcEIsR0FBSSxvQkFBcUI7TUFDdkI7TUFDQTtNQUNBLFdBQVcsT0FBTztNQUNsQixXQUFXLFFBQVE7TUFDbkIsb0JBQXFCO01BQ3JCLGlCQUFrQjs7TUFFbEIsa0JBQWtCLFNBQVM7TUFDM0IsaUJBQWtCO01BQ2xCLFdBQVcsT0FBTzs7TUFFbEIsaUJBQWtCO1FBQ2hCO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O01BRUY7ZUFDTztVQUNIO1VBQ0E7O0lBRU4sR0FBSSxtQkFBb0I7TUFDdEI7TUFDQSxvQkFBcUI7TUFDckIsaUJBQWtCOztNQUVsQixrQkFBa0IsU0FBUztNQUMzQixpQkFBa0I7O01BRWxCLGlCQUFrQjtRQUNoQjtRQUNBO1FBQ0E7O01BRUY7ZUFDTztVQUNIO1VBQ0E7O0VDL0NSLFNBQVUsa0JBQW1COztJQUUzQixHQUFJLGFBQWM7TUFDaEIsZUFBZ0IsTUFBUTtNQUN4QixpQkFBa0I7OztJQUdwQixHQUFJLFlBQWE7TUFDZixlQUFnQixTQUFXOztNQUUzQjtNQUNBLGtCQUFrQixTQUFTOztNQUUzQixpQkFBa0I7OztJQUdwQixHQUFJLGtCQUFtQjtNQUNyQjtRQUNFO1VBQ0U7VUFDQSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRzs7TUFFbEIsaUJBQWtCO1FBQ2hCLEtBQUssR0FBRztRQUNSLEtBQUssR0FBRztRQUNSLEtBQUssR0FBRzs7TUFFVjtRQUNFO2FBQ0c7ZUFDRTtZQUNEOzs7SUFHUixHQUFJLG9CQUFxQjtNQUN2QjtRQUNFO1VBQ0U7VUFDQSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRzs7TUFFbEIsaUJBQWtCO1FBQ2hCLEtBQUssR0FBRztRQUNSLEtBQUssR0FBRztRQUNSLEtBQUssR0FBRzs7O01BR1Y7UUFDRTttQkFDUztxQkFDRTtZQUNQOztFQ2xEVixTQUFVLFlBQWE7O0lBRXJCLEdBQUksaUJBQWtCO1FBQ2xCLG9CQUFxQjs7UUFFckIsMkJBQTRCOztRQUU1Qiw0QkFBNEIsU0FBUztRQUNyQyx5QkFBeUIsVUFBVTs7UUFFbkM7UUFDQSxrQkFBa0IsU0FBUzs7UUFFM0I7UUFDQSxrQkFBa0IsU0FBUztRQUMzQjtRQUNBLGtCQUFrQixTQUFTO1FBQzNCO1FBQ0Esa0JBQWtCLFNBQVM7O1FBRTNCOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBLGlCQUFrQixhQUFpQjtRQUNuQyxpQkFBa0IsYUFBaUI7UUFDbkMsaUJBQWtCLGFBQWlCOztRQUVuQyxPQUFRO1FBQ1IsT0FBUTtRQUNSLE9BQVE7OztJQUdaLEdBQUksZUFBZ0I7UUFDaEIsb0JBQXFCO1FBQ3JCO1FBQ0Esa0JBQW1CO1FBQ25CLE9BQVE7O1FBRVIsNEJBQTRCLFVBQVU7O1FBRXRDO1FBQ0Esa0JBQWtCLFNBQVM7O1FBRTNCO1FBQ0Esa0JBQWtCLFNBQVM7UUFDM0I7UUFDQSxrQkFBa0IsU0FBUztRQUMzQjtRQUNBLGtCQUFrQixTQUFTOztRQUUzQixhQUFjLFNBQVU7UUFDeEI7O1FBRUE7O1FBRUEsaUJBQWtCLGFBQWlCO1FBQ25DLGlCQUFrQixhQUFpQjtRQUNuQyxpQkFBa0IsYUFBaUI7O1FBRW5DLE9BQVE7UUFDUixPQUFRO1FBQ1IsT0FBUTs7RUN6RWQsU0FBVSxrQkFBbUI7SUFDM0IsR0FBSSxPQUFRO01BQ1Y7TUFDQSxxQkFBcUIsT0FBTztNQUM1Qix1QkFBdUIsVUFBVTtNQUNqQyx1QkFBdUIsVUFBVTtNQUNqQyx1QkFBdUIsVUFBVTs7O0lBR25DLEdBQUksV0FBWTtNQUNkOztNQUVBO01BQ0EsYUFBYyxTQUFVOztNQUV4QjtNQUNBLGFBQWM7OztJQUdoQixHQUFJLGtCQUFtQjtNQUNyQjtNQUNBOztNQUVBLE9BQVE7TUFDUjtNQUNBLE9BQVE7TUFDUixPQUFROztNQUVSLGFBQWMsS0FBTTs7TUFFcEIsT0FBUTtNQUNSLE9BQVE7TUFDUjtNQUNBLE9BQVE7TUFDUixPQUFROztNQUVSLGFBQWMsS0FBTTs7O0lBR3RCLEdBQUksd0JBQXlCO01BQzNCOztNQUVBLE9BQVE7TUFDUixPQUFRO01BQ1IsT0FBUTs7O0lBR1YsR0FBSSxnQkFBaUI7TUFDbkI7O01BRUEsUUFBUTtNQUNSLG1CQUFtQixHQUFHOztNQUV0QjtRQUNFLElBQUk7O1VBRUY7V0FDQyxxQkFBcUIsSUFBSTs7UUFFNUIsSUFBSTtVQUNGO1dBQ0MscUJBQXFCLElBQUk7UUFDNUIsSUFBSTtRQUNKOztNQUVGLGFBQWMsU0FBVTtNQUN4QixtQkFBbUIsR0FBRzs7O1FBR3BCO1FBQ0E7O01BRUYsbUJBQW1CLEdBQUc7TUFDdEIsYUFBYyxTQUFVO01BQ3hCLG1CQUFtQixHQUFHOzs7UUFHcEI7UUFDQTs7TUFFRixtQkFBbUIsR0FBRztNQUN0QixhQUFjO01BQ2QsbUJBQW1CLEdBQUc7O0VDbEYxQixTQUFVLGFBQWM7SUFDdEIsR0FBSSxPQUFRO01BQ1Y7O01BRUEscUJBQXFCLE9BQU87TUFDNUIsdUJBQXVCLFVBQVU7TUFDakMsdUJBQXVCLFVBQVU7TUFDakMsdUJBQXVCLFVBQVU7O01BRWpDOzs7SUFHRixHQUFJLFdBQVk7TUFDZDs7TUFFQTtNQUNBLGFBQWMsU0FBVTs7TUFFeEI7TUFDQSxhQUFjOzs7SUFHaEIsR0FBSSxnQkFBaUI7TUFDbkI7O01BRUEsbUJBQWdCLE9BQVEsT0FBTzs7aUJBRXRCO1FBQ1AsYUFBYyxPQUFRO1FBQ3RCOzs7SUFHSixHQUFJLHNCQUF1QjtNQUN6Qjs7TUFFQTttQkFDVztVQUNQLE9BQU8sTUFBTSxFQUFFOztNQUVuQjttQkFDVztVQUNQLE9BQU8sTUFBTSxFQUFFOztNQUVuQjs7TUFFQSxhQUFjLFNBQVU7TUFDeEIsYUFBYyxTQUFVO01BQ3hCLGFBQWMsU0FBVTs7TUFFeEIsT0FBTyxPQUFPO01BQ2QsYUFBYyxVQUFXO01BQ3pCLGFBQWMsVUFBVztNQUN6QixhQUFjLE9BQVE7O0VDcEQxQixTQUFVLGNBQWU7SUFDdkIsR0FBSSxPQUFRO01BQ1YsMEJBQTJCO01BQzNCLDZCQUE2QixVQUFVOzs7SUFHekMsR0FBSSxXQUFZO01BQ2Q7O01BRUE7TUFDQSxhQUFjLFNBQVU7O01BRXhCO01BQ0EsYUFBYzs7O0lBR2hCLEdBQUksZ0JBQWlCO01BQ25COztNQUVBLG1CQUFnQixXQUFZLE9BQU87O2lCQUUxQjtRQUNQLGFBQWMsT0FBUTtRQUN0Qjs7O0lBR0osR0FBSSxzQkFBdUI7TUFDekI7O01BRUE7bUJBQ1c7VUFDUCxPQUFPLE1BQU0sRUFBRTs7TUFFbkI7bUJBQ1c7VUFDUCxPQUFPLE1BQU0sRUFBRTs7TUFFbkI7O01BRUEsYUFBYyxTQUFVO01BQ3hCLGFBQWMsU0FBVTtNQUN4QixhQUFjLFNBQVU7O01BRXhCLFdBQVcsT0FBTztNQUNsQixhQUFjLFVBQVc7TUFDekIsYUFBYyxVQUFXO01BQ3pCLGFBQWMsT0FBUTs7RUM5QzFCLFNBQVUsYUFBYztJQUN0QixHQUFJLE9BQVE7TUFDViwwQkFBMkI7O01BRTNCLGlDQUFpQyxVQUFVO01BQzNDLGlDQUFpQyxVQUFVO01BQzNDLGlDQUFpQyxVQUFVOztNQUUzQyw2QkFBNkIsVUFBVTtNQUN2Qyw2QkFBNkIsVUFBVTs7TUFFdkMsNEJBQTRCLFVBQVU7TUFDdEMsNkJBQTZCLFVBQVU7OztJQUd6QyxHQUFJLFdBQVk7TUFDZDs7TUFFQTtNQUNBLGFBQWMsU0FBVTs7TUFFeEI7TUFDQSxhQUFjOzs7SUFHaEIsR0FBSSxnQkFBaUI7TUFDbkI7O01BRUEsbUJBQWdCLFdBQVksT0FBTzs7aUJBRTFCO1FBQ1AsYUFBYyxPQUFRO1FBQ3RCOzs7SUFHSixHQUFJLHNCQUF1QjtNQUN6Qjs7TUFFQTttQkFDVztVQUNQLE9BQU8sTUFBTSxFQUFFOztNQUVuQjttQkFDVztVQUNQLE9BQU8sTUFBTSxFQUFFOztNQUVuQjs7TUFFQSxhQUFjLFNBQVU7TUFDeEIsYUFBYyxTQUFVO01BQ3hCLGFBQWMsU0FBVTs7TUFFeEIsV0FBVyxPQUFPO01BQ2xCLGFBQWMsVUFBVztNQUN6QixhQUFjLFVBQVc7TUFDekIsYUFBYyxPQUFROztFQ2xEMUIsU0FBVSxzQkFBdUI7SUFDL0IsR0FBSSxPQUFRO01BQ1Y7UUFDRTs7TUFFRjtNQUNBLGlDQUFpQyxVQUFVO01BQzNDLG9DQUFvQyxTQUFTOztJQUUvQyxHQUFJLFNBQVU7TUFDWjs7TUFFQTtNQUNBLHVCQUF1QixTQUFTOztNQUVoQyxpQ0FBa0M7TUFDbEMsc0JBQXNCLFNBQVM7O01BRS9CLDhCQUErQjs7SUFFakMsR0FBSSxLQUFNO01BQ1I7UUFDRTtxQkFDVztZQUNQOztNQUVOOztNQUVBO1FBQ0UsWUFBYTtRQUNiOztNQUVGOztNQUVBO1FBQ0U7O0VDbENOLFNBQVUsNEJBQTZCO0lBQ3JDLEdBQUksT0FBUTtNQUNWO1FBQ0U7O01BRUYsT0FBUTtNQUNSLGdDQUFnQyxVQUFVO01BQzFDLG1DQUFtQyxTQUFTOztJQUU5QyxHQUFJLFNBQVU7TUFDWjtNQUNBLHVCQUF3QjtRQUN0Qjs7TUFFRjtTQUNLO1FBQ0g7O0lBRUosR0FBSSxPQUFRO01BQ1Y7UUFDRTtVQUNFO2VBQ0c7WUFDRDtZQUNBOztNQUVOLHVCQUF3QjtRQUN0Qjs7TUFFRjtTQUNLO1FBQ0g7OztJQUdKLEdBQUksT0FBUTtNQUNWO1FBQ0U7cUJBQ1c7WUFDUCxPQUFPLElBQUk7O01BRWpCLHVCQUF3QjtRQUN0Qjs7TUFFRjtTQUNLLENBQUUsSUFBSTtZQUNMLENBQUMsSUFBSTtZQUNMLENBQUMsSUFBSTtRQUNUOzs7SUFHSjtNQUNFOztNQUVBO1FBQ0U7UUFDQTs7TUFFRjs7RUN6REosU0FBVSw4QkFBK0I7SUFDdkMsU0FBVSxTQUFVO01BQ2xCLEdBQUksT0FBUTtRQUNWO1VBQ0U7aUJBQ0s7Y0FDRDs7UUFFTjs7UUFFQTtVQUNFLFlBQWE7VUFDYjs7UUFFRixpQkFBa0IsU0FBYTs7O01BR2pDLEdBQUksU0FBVTtRQUNaO1VBQ0U7WUFDRTtpQkFDRztjQUNEO2NBQ0E7O1FBRU47O1FBRUE7VUFDRSxZQUFhO1VBQ2I7O1FBRUYsaUJBQWtCLFNBQWE7OztNQUdqQyxHQUFJLE1BQU87UUFDVDs7UUFFQTtVQUNFO1lBQ0UsU0FBVTtZQUNWO2NBQ0U7Y0FDQSxHQUFHOztZQUVMO2NBQ0U7O2NBRUE7Y0FDQSxTQUFVOztRQUVoQjs7UUFFQSxpQkFBa0IsS0FBUzs7UUFFM0I7UUFDQTs7UUFFQSxpQkFBa0IsS0FBUyxZQUFhLEVBQUU7O1FBRTFDLGlCQUFrQixTQUFhOzs7SUFHbkMsU0FBVSx3QkFBeUI7TUFDakMsR0FBSSxLQUFNO1FBQ1I7VUFDRTs7UUFFRjtRQUNBLG1CQUFtQixTQUFTOztRQUU1QjtVQUNFLFlBQWE7VUFDYjs7UUFFRjtRQUNBLG1CQUFtQixTQUFTO1FBQzVCO1FBQ0E7O1FBRUE7UUFDQSxtQkFBbUIsU0FBUzs7UUFFNUIsZ0NBQWlDO1FBQ2pDLGdDQUFpQzs7O01BR25DLEdBQUksS0FBTTtRQUNSOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EsT0FBUSw0QkFBNkI7O1FBRXJDO1FBQ0E7O1FBRUE7UUFDQSw0QkFBNEIsVUFBVTs7UUFFdEM7VUFDRSxZQUFhO1VBQ2I7O1FBRUYsa0JBQWtCLFNBQVM7UUFDM0Isa0JBQWtCLFNBQVM7UUFDM0Isa0JBQWtCLFNBQVM7O1FBRTNCOztRQUVBLCtCQUFnQztRQUNoQywrQkFBZ0M7UUFDaEMsK0JBQWdDOzs7TUFHbEMsR0FBSSxPQUFRO1FBQ1Y7VUFDRTs7UUFFRjtRQUNBO1FBQ0E7O1FBRUEseUJBQXlCLFVBQVU7UUFDbkMsNEJBQTRCLFNBQVM7O1FBRXJDLGtCQUFrQixTQUFTO1FBQzNCLGtCQUFrQixTQUFTO1FBQzNCLGtCQUFrQixTQUFTOztRQUUzQjtVQUNFLFlBQWE7VUFDYjs7UUFFRjtRQUNBLGtCQUFrQixTQUFTO1FBQzNCLHlCQUEwQjs7UUFFMUIsK0JBQWdDO1FBQ2hDLCtCQUFnQztRQUNoQywrQkFBZ0M7O0VDL0l0QyxTQUFVLE1BQU87SUFDZixHQUFJLE9BQVE7TUFDVixNQUFPO01BQ1AsTUFBTztNQUNQLE1BQU87OztJQUdULEdBQUksYUFBYztNQUNoQjtRQUNFO01BQ0Y7O01BRUE7UUFDRTtRQUNBLGtCQUFrQixTQUFTOztRQUUzQjtRQUNBOzs7UUFHQTs7O0lBR0osR0FBSSxZQUFhO01BQ2Y7UUFDRTtNQUNGOztNQUVBO1FBQ0U7UUFDQSxrQkFBa0IsU0FBUzs7UUFFM0I7UUFDQTs7O1FBR0E7OztJQUdKLEdBQUksYUFBYztNQUNoQjtRQUNFO01BQ0Y7O01BRUEsd0JBQXdCLFNBQVM7O01BRWpDO01BQ0Esa0JBQWtCLFNBQVM7O01BRTNCO01BQ0E7O01BRUE7OztJQUdGLEdBQUksVUFBVztNQUNiLGVBQWdCLFNBQVc7O01BRTNCO1FBQ0U7UUFDQSxrQkFBa0IsU0FBUzs7UUFFM0I7UUFDQTs7UUFFQTtRQUNBOzs7UUFHQTs7RUNyRU4sU0FBVSxzQkFBdUI7SUFDL0IsR0FBSSxPQUFRO01BQ1YsTUFBTzs7UUFFTixXQUFXOztNQUVaLEdBQUksa0JBQW1CO1FBQ3JCLDRCQUE2QjtRQUM3Qjs7UUFFQTtVQUNFO1VBQ0Esa0JBQWtCLFNBQVM7O1VBRTNCO1VBQ0E7OztVQUdBOztNQUVKLEdBQUksVUFBVztRQUNiLGVBQWdCLFNBQVc7O1FBRTNCO1VBQ0U7VUFDQSxrQkFBa0IsU0FBUzs7VUFFM0I7VUFDQTs7VUFFQTtVQUNBOzs7VUFHQTs7RUNoQ1IsU0FBVSxZQUFhO0lBQ3JCLEdBQUksT0FBUTtNQUNWLE1BQU87O01BRVAsZ0JBQWlCO01BQ2pCLE9BQVE7TUFDUixNQUFPOzs7SUFHVCxHQUFJLG1CQUFvQjtNQUN0QjtRQUNFOztNQUVGOzs7TUFHQSxNQUFPO01BQ1AsTUFBTzs7O1FBR04sV0FBVzs7TUFFWixHQUFJLGtCQUFtQjtRQUNyQjs7UUFFQTtRQUNBOztRQUVBO29CQUNhO2tCQUNELFNBQVMsVUFBVzs7O2VBRzNCLFVBQVcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO1lBQ3pCLGtCQUFvQixtQkFBbUIsRUFBRTtZQUN6Qzs7VUFFRjs7UUFFRjtXQUNLLFdBQVk7V0FDWixXQUFZO1dBQ1osV0FBWTs7UUFFakI7Ozs7In0=
