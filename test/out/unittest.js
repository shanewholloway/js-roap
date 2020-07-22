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
  const ao_check_done = err => {
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


  async function * ao_iter_fenced(gen_in, f_gate, initial=false) {
    let f = true === initial ? f_gate.fence() : initial;
    for await (let v of gen_in) {
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



  const _ao_fence_api_ ={
    __proto__:{
      // generator api
      next(v) {return {value: this.resume(v), done: true}}
    , return() {return {value: this.abort(ao_done), done: true}}
    , throw(err) {return {value: this.abort(err), done: true}}

    , ao_check_done
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
        ao_check_done(err);} } };


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
        ao_check_done(err);}
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
    ag_tap.f_tap = ag_tap.f_out = f_tap;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVycmVkLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2Vfdi5qc3kiLCIuLi91bml0L2ZlbmNlX2ZuLmpzeSIsIi4uL3VuaXQvZmVuY2Vfb2JqLmpzeSIsIi4uL3VuaXQvZmVuY2VfaW4uanN5IiwiLi4vdW5pdC9xdWV1ZS5qc3kiLCIuLi91bml0L3BpcGVfYmFzZS5qc3kiLCIuLi91bml0L3BpcGUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBleHBlY3QoZm4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2Jhc2ljKGYpIDo6XG4gIGlzX2ZuKGYuZmVuY2UpXG4gIGlzX2ZuKGYuYW9fZm9yaylcbiAgaXNfYXN5bmNfaXRlcmFibGUoZilcbiAgcmV0dXJuIGZcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZlbmNlX2Z1bGwoZikgOjpcbiAgaXNfZmVuY2VfYmFzaWMoZilcbiAgaXNfZm4oZi5hYm9ydClcbiAgaXNfZm4oZi5yZXN1bWUpXG5cbiAgaXNfZm4oZi5uZXh0KVxuICBpc19mbihmLnJldHVybilcbiAgaXNfZm4oZi50aHJvdylcblxuICBpc19mbihmLmFvX2NoZWNrX2RvbmUpXG4gIGlzX2ZuKGYuY2hhaW4pXG4gIHJldHVybiBmXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19hc3luY19pdGVyYWJsZShvKSA6OlxuICBhc3NlcnQgQCBudWxsICE9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCAnYXN5bmMgaXRlcmFibGUnXG4gIHJldHVybiBvXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcnJheV9mcm9tX2FvX2l0ZXIoZykgOjpcbiAgbGV0IHJlcyA9IFtdXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgcmVzLnB1c2godilcbiAgcmV0dXJuIHJlc1xuXG4iLCJjb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBpc19hb19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5cblxuY29uc3QgYW9fZG9uZSA9IE9iamVjdC5mcmVlemUoe2FvX2RvbmU6IHRydWV9KTtcbmNvbnN0IGFvX2NoZWNrX2RvbmUgPSBlcnIgPT4ge1xuICBpZiAoZXJyICE9PSBhb19kb25lICYmIGVyciAmJiAhZXJyLmFvX2RvbmUpIHtcbiAgICB0aHJvdyBlcnJ9XG4gIHJldHVybiB0cnVlfTtcblxuXG5mdW5jdGlvbiAqIGl0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogZ2VuX2luO31cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBnZW5faW47fVxuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwpIHtcbiAgY2hhaW4udGFpbCA9IHRhaWw7XG4gIHJldHVybiBjaGFpbi5jaGFpbiA9IGNoYWluXG4gIGZ1bmN0aW9uIGNoYWluKGZuKSB7XG4gICAgY2hhaW4udGFpbCA9IGZuKGNoYWluLnRhaWwpO1xuICAgIHJldHVybiBjaGFpbn0gfVxuXG5jb25zdCBhb19kZWZlcnJlZF92ID0gKCgoKSA9PiB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgW3AsIHksIG5dKSB9KSgpKTtcblxuY29uc3QgYW9fZGVmZXJyZWQgPSB2ID0+KFxuICB2ID0gYW9fZGVmZXJyZWRfdigpXG4sIHtwcm9taXNlOiB2WzBdLCByZXNvbHZlOiB2WzFdLCByZWplY3Q6IHZbMl19KTtcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbikge1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgY2xvc2VfdGd0KSB7XG4gIGlmIChpc19hb19mbihnZW5fdGd0KSkge1xuICAgIGdlbl90Z3QgPSBnZW5fdGd0KCk7XG4gICAgZ2VuX3RndC5uZXh0KCk7fVxuXG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge2JyZWFrfSB9XG5cbiAgaWYgKGNsb3NlX3RndCkge1xuICAgIGF3YWl0IGdlbl90Z3QucmV0dXJuKCk7fSB9XG5cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBvcl9tb3JlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlLCBkb25lfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtyZXR1cm4gdmFsdWV9XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChvcl9tb3JlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgb3JfbW9yZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZSwgZG9uZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIGlmIChkb25lKSB7cmV0dXJuIHZhbHVlfVxuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAob3JfbW9yZSkgfSB9IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXJfZmVuY2VkKGdlbl9pbiwgZl9nYXRlLCBpbml0aWFsPWZhbHNlKSB7XG4gIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbCA/IGZfZ2F0ZS5mZW5jZSgpIDogaW5pdGlhbDtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICBhd2FpdCBmO1xuICAgIHlpZWxkIHY7XG4gICAgZiA9IGZfZ2F0ZS5mZW5jZSgpO30gfVxuXG5mdW5jdGlvbiBhb19mZW5jZV92KHByb3RvKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSBfPT4wLCBfYWJvcnQgPSBfPT4wO1xuICBsZXQgX3BzZXQgPSAoeSxuKSA9PiB7X3Jlc3VtZT15OyBfYWJvcnQ9bjt9O1xuXG4gIGxldCBmZW5jZSA9ICgpID0+KDAgIT09IHAgPyBwIDogcD1uZXcgUHJvbWlzZShfcHNldCkpO1xuICBsZXQgcmVzdW1lID0gKGFucykgPT4ocD0wLCBfcmVzdW1lKGFucykpO1xuICBsZXQgYWJvcnQgPSAoZXJyPWFvX2RvbmUpID0+KHA9MCwgX2Fib3J0KGVycikpO1xuXG4gIHJldHVybiBwcm90b1xuICAgID97X19wcm90b19fOiBwcm90bywgZmVuY2UsIHJlc3VtZSwgYWJvcnR9XG4gICAgOltmZW5jZSwgcmVzdW1lLCBhYm9ydF0gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2FwaV8gPXtcbiAgX19wcm90b19fOntcbiAgICAvLyBnZW5lcmF0b3IgYXBpXG4gICAgbmV4dCh2KSB7cmV0dXJuIHt2YWx1ZTogdGhpcy5yZXN1bWUodiksIGRvbmU6IHRydWV9fVxuICAsIHJldHVybigpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGFvX2RvbmUpLCBkb25lOiB0cnVlfX1cbiAgLCB0aHJvdyhlcnIpIHtyZXR1cm4ge3ZhbHVlOiB0aGlzLmFib3J0KGVyciksIGRvbmU6IHRydWV9fVxuXG4gICwgYW9fY2hlY2tfZG9uZVxuICAsIGNoYWluKGZuKSB7cmV0dXJuIGZuX2NoYWluKHRoaXMpKGZuKX0gfVxuXG4sIC8vIGNvcHlhYmxlIGZlbmNlIGFwaVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgcmV0dXJuIHRoaXMuYW9fZm9yaygpfVxuXG4sIGFzeW5jICogYW9fZm9yaygpIHtcbiAgICBsZXQge2ZlbmNlfSA9IHRoaXM7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIHlpZWxkIGF3YWl0IGZlbmNlKCk7fSB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgYW9fY2hlY2tfZG9uZShlcnIpO30gfSB9O1xuXG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IE9iamVjdC5hc3NpZ24odGd0LCBfYW9fZmVuY2VfYXBpXyk7XG4gIHJldHVybiBmfVxuXG5cbmNvbnN0IGFvX2ZlbmNlX29iaiA9IGFvX2ZlbmNlX3YuYmluZChudWxsLHtcbiAgX19wcm90b19fOiBfYW9fZmVuY2VfYXBpX1xuXG4sIGFzeW5jICogYW9fZ2F0ZWQoZl9nYXRlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgIGxldCB2ID0gYXdhaXQgZl9nYXRlLmZlbmNlKCk7XG4gICAgICAgIHlpZWxkIHY7XG4gICAgICAgIHRoaXMucmVzdW1lKHYpO30gfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgIGFvX2NoZWNrX2RvbmUoZXJyKTt9XG4gICAgZmluYWxseSB7XG4gICAgICBmX2dhdGUuYWJvcnQoKTtcbiAgICAgIHRoaXMuYWJvcnQoKTt9IH0gfSApO1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IHtmX291dH0gPSBhZ19vdXQ7XG4gIGlmICh1bmRlZmluZWQgPT09IGZfb3V0KSB7XG4gICAgW2Zfb3V0LCBhZ19vdXRdID0gYW9fdGFwKGFnX291dCk7fVxuXG4gIGZfb3V0LndoZW5fcnVuID0gYW9fcnVuKGFnX291dCk7XG4gIHJldHVybiBmX291dH1cblxuXG5mdW5jdGlvbiBhb190YXAoaXRlcmFibGUsIG9yZGVyPTEpIHtcbiAgbGV0IGZfdGFwID0gYW9fZmVuY2Vfb2JqKCk7XG4gIGxldCBhZ190YXAgPSBfYW9fdGFwKGl0ZXJhYmxlLCBmX3RhcCwgb3JkZXIpO1xuICBhZ190YXAuZl90YXAgPSBhZ190YXAuZl9vdXQgPSBmX3RhcDtcbiAgYWdfdGFwLmdfaW4gPSBmX3RhcC5nX2luID0gaXRlcmFibGUuZ19pbjtcbiAgcmV0dXJuIFtmX3RhcCwgYWdfdGFwXX1cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fdGFwKGl0ZXJhYmxlLCBnX3RhcCwgb3JkZXI9MSkge1xuICB0cnkge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgaXRlcmFibGUpIHtcbiAgICAgIGlmICgwID49IG9yZGVyKSB7YXdhaXQgZ190YXAubmV4dCh2KTt9XG4gICAgICB5aWVsZCB2O1xuICAgICAgaWYgKDAgPD0gb3JkZXIpIHthd2FpdCBnX3RhcC5uZXh0KHYpO30gfSB9XG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnX3RhcC5yZXR1cm4oKTt9IH1cblxuY29uc3QgYW9fZmVuY2VfaW4gPSBhb19mZW5jZV92LmJpbmQobnVsbCx7XG4gIF9fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaV9cblxuLCBhb19waXBlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX2l0ZXIsIC4uLiBuc19nZW59KSB9XG4sIGFvX3F1ZXVlKG5zX2dlbikge1xuICAgIHJldHVybiB0aGlzLmFvX3hmb3JtX3J1bih7XG4gICAgICB4aW5pdDogYW9nX3NpbmssIC4uLiBuc19nZW59KSB9XG5cbiwgYW9nX2l0ZXIoeGYpIHtyZXR1cm4gYW9nX2l0ZXIodGhpcyl9XG4sIGFvZ19zaW5rKGZfZ2F0ZSwgeGYpIHtyZXR1cm4gYW9nX3NpbmsodGhpcywgZl9nYXRlLCB4Zil9XG5cblxuLCBhb194Zm9ybV90YXAobnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3RhcChcbiAgICAgIHRoaXMuYW9feGZvcm1fcmF3KG5zX2dlbikpIH1cblxuLCBhb194Zm9ybV9ydW4obnNfZ2VuKSB7XG4gICAgcmV0dXJuIGFvX3NwbGl0KFxuICAgICAgdGhpcy5hb194Zm9ybV9yYXcobnNfZ2VuKSkgfVxuXG4sIGFvX3hmb3JtX3Jhdyhuc19nZW49YW9nX3NpbmspIHtcbiAgICBsZXQge3hpbml0LCB4cmVjdiwgeGVtaXR9ID0gbnNfZ2VuO1xuICAgIGlmICh1bmRlZmluZWQgPT09IHhpbml0KSB7XG4gICAgICB4aW5pdCA9IGlzX2FvX2ZuKG5zX2dlbikgPyBuc19nZW4gOiBhb2dfc2luazt9XG5cblxuICAgIGxldCBhZ19vdXQsIGZfb3V0ID0gYW9fZmVuY2Vfb2JqKCk7XG4gICAgbGV0IHJlcyA9IHhpbml0KHRoaXMsIGZfb3V0LCB4cmVjdik7XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSByZXMuZ19pbikge1xuICAgICAgLy8gcmVzIGlzIGFuIG91dHB1dCBnZW5lcmF0b3JcbiAgICAgIGFnX291dCA9IHJlcztcbiAgICAgIGZfb3V0LmdfaW4gPSByZXMuZ19pbjt9XG5cbiAgICBlbHNlIHtcbiAgICAgIC8vIHJlcyBpcyBhbiBpbnB1dCBnZW5lcmF0b3JcbiAgICAgIHJlcy5uZXh0KCk7XG5cbiAgICAgIGFnX291dCA9IGZfb3V0LmFvX2dhdGVkKHRoaXMpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBmX291dC5nX2luID0gcmVzO1xuICAgICAgYWdfb3V0LmZfb3V0ID0gZl9vdXQ7fVxuXG5cbiAgICBpZiAoeGVtaXQpIHtcbiAgICAgIGxldCB7Z19pbn0gPSBhZ19vdXQ7XG4gICAgICBhZ19vdXQgPSB4ZW1pdChhZ19vdXQpO1xuICAgICAgYWdfb3V0LmdfaW4gPSBnX2luO31cblxuICAgIHJldHVybiBhZ19vdXR9IH0gKTtcblxuXG5cbmZ1bmN0aW9uICogYW9nX2l0ZXIoZywgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0geGYpIHtcbiAgICAgICAgdGlwID0geGYubmV4dCh0aXApLnZhbHVlO31cbiAgICAgIGcubmV4dCh0aXApO30gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnLnJldHVybigpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9nX3NpbmsoZywgZl9nYXRlLCB4Zikge1xuICB4ZiA9IHhmID8gX3hmX2dlbi5jcmVhdGUoeGYpIDogdm9pZCB4ZjtcbiAgdHJ5IHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgIHtcbiAgICAgICAgbGV0IHRpcCA9IHlpZWxkO1xuICAgICAgICBpZiAodW5kZWZpbmVkICE9PSB4Zikge1xuICAgICAgICAgIHRpcCA9IGF3YWl0IHhmLm5leHQodGlwKTtcbiAgICAgICAgICB0aXAgPSB0aXAudmFsdWU7fVxuICAgICAgICBhd2FpdCBnLm5leHQodGlwKTt9XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGZfZ2F0ZSkge1xuICAgICAgICBhd2FpdCBmX2dhdGUuZmVuY2UoKTt9IH0gfVxuXG4gIGNhdGNoIChlcnIpIHtcbiAgICBhb19jaGVja19kb25lKGVycik7fVxuICBmaW5hbGx5IHtcbiAgICBnLnJldHVybigpO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhmKSB7XG4gICAgICB4Zi5yZXR1cm4oKTt9IH0gfVxuXG5cbmNvbnN0IF94Zl9nZW4gPXtcbiAgY3JlYXRlKHhmKSB7XG4gICAgbGV0IHNlbGYgPSB7X19wcm90b19fOiB0aGlzfTtcbiAgICBzZWxmLnhnID0geGYoc2VsZi54Zl9pbnYoKSk7XG4gICAgcmV0dXJuIHNlbGZ9XG5cbiwgKnhmX2ludigpIHtcbiAgICB3aGlsZSAoMSkge1xuICAgICAgbGV0IHRpcCA9IHRoaXMuX3RpcDtcbiAgICAgIGlmICh0aGlzID09PSB0aXApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmRlcmZsb3cnKX1cbiAgICAgIGVsc2UgdGhpcy5fdGlwID0gdGhpcztcblxuICAgICAgeWllbGQgdGlwO30gfVxuXG4sIG5leHQodikge1xuICAgIHRoaXMuX3RpcCA9IHY7XG4gICAgcmV0dXJuIHRoaXMueGcubmV4dCh2KX1cblxuLCByZXR1cm4oKSB7dGhpcy54Zy5yZXR1cm4oKTt9XG4sIHRocm93KCkge3RoaXMueGcudGhyb3coKTt9IH07XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDAsIGdlbl9pbikge1xuICBsZXQgW19mZW5jZSwgX3Jlc3VtZSwgX2Fib3J0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzdW1lLCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2Fib3J0KCk7fSk7XG5cbiAgcmV0dXJuIG51bGwgPT0gZ2VuX2luID8gX2ZlbmNlXG4gICAgOiBhb19pdGVyX2ZlbmNlZChnZW5faW4sIF9mZW5jZSl9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwLCBnZW5faW4pIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc3VtZV0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcblxuICByZXR1cm4gbnVsbCA9PSBnZW5faW4gPyB0aW1lb3V0XG4gICAgOiBhb19pdGVyX2ZlbmNlZChnZW5faW4sIHRpbWVvdXQpXG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXN1bWUsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwO1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzdW1lLCBtcywgdik7fVxuXG4gICAgICBhd2FpdCBwO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBhb19jaGVja19kb25lKGVycik7fSB9KSgpKTtcblxuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmFzeW5jIGZ1bmN0aW9uICogYW9fdGltZXMoZ2VuX2luKSB7XG4gIGxldCB0czAgPSBEYXRlLm5vdygpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIGdlbl9pbikge1xuICAgIHlpZWxkIERhdGUubm93KCkgLSB0czA7fSB9XG5cbmZ1bmN0aW9uIGFvX2RvbV9hbmltYXRpb24oZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXN1bWVdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuXG4gIHJldHVybiBudWxsID09IGdlbl9pbiA/IHJhZlxuICAgIDogYW9faXRlcl9mZW5jZWQoZ2VuX2luLCByYWYpXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzdW1lKTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgX2V2dF9pbml0ID0gUHJvbWlzZS5yZXNvbHZlKHt0eXBlOidpbml0J30pO1xuZnVuY3Rpb24gYW9fZG9tX2xpc3RlbihwaXBlID0gYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpKSB7XG4gIGxldCB3aXRoX2RvbSA9IChkb20sIGZuKSA9PlxuICAgIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSk7XG5cbiAgX2JpbmQuc2VsZiA9IHtwaXBlLCB3aXRoX2RvbX07XG4gIHBpcGUud2l0aF9kb20gPSB3aXRoX2RvbTtcbiAgcmV0dXJuIHBpcGVcblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgcGlwZS5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKGlzX2FvX2ZuKGZuKSkge1xuICAgIF9ldnRfaW5pdC50aGVuKFxuICAgICAgX29uX2V2dCA9IF9iaW5kKGRvbSwgdm9pZCAwLCBmbikpOyB9XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgbGV0IG9wdCwgZXZ0X2ZuID0gX29uX2V2dDtcblxuICAgICAgbGV0IGxhc3QgPSBhcmdzLnBvcCgpO1xuICAgICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBsYXN0KSB7XG4gICAgICAgIGV2dF9mbiA9IF9iaW5kKGRvbSwgbGFzdCwgX29uX2V2dCk7XG4gICAgICAgIGxhc3QgPSBhcmdzLnBvcCgpO31cblxuICAgICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBhcmdzLnB1c2gobGFzdCk7fVxuICAgICAgZWxzZSBvcHQgPSBsYXN0O1xuXG4gICAgICBmb3IgKGxldCBldnQgb2YgYXJncykge1xuICAgICAgICBkb20uYWRkRXZlbnRMaXN0ZW5lcihcbiAgICAgICAgICBldnQsIGV2dF9mbiwgb3B0KTsgfVxuXG4gICAgICByZXR1cm4gdGhpc30gfSB9XG5cblxuZnVuY3Rpb24gX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGVjdHhfbGlzdCkge1xuICBlY3R4X2xpc3QgPSBBcnJheS5mcm9tKGVjdHhfbGlzdCxcbiAgICBkb20gPT4gX2FvX3dpdGhfZG9tKF9iaW5kLCBmbiwgZG9tKSk7XG5cbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9iaW5kLnNlbGZcbiAgLCBsaXN0ZW4oLi4uYXJncykge1xuICAgICAgZm9yIChsZXQgZWN0eCBvZiBlY3R4X2xpc3QpIHtcbiAgICAgICAgZWN0eC5saXN0ZW4oLi4uYXJncyk7fVxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5leHBvcnQgeyBfYW9fZmVuY2VfYXBpXywgX2FvX3RhcCwgX3hmX2dlbiwgYW9fY2hlY2tfZG9uZSwgYW9fZGVib3VuY2UsIGFvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92LCBhb19kb21fYW5pbWF0aW9uLCBhb19kb21fbGlzdGVuLCBhb19kb25lLCBhb19kcml2ZSwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX2luLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX3YsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19pdGVyX2ZlbmNlZCwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBhb2dfaXRlciwgYW9nX3NpbmssIGZuX2NoYWluLCBpc19hb19mbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImltcG9ydCB7YXNzZXJ0LCBpc19mbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5pbXBvcnQge2FvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19mZW5jZV92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV9pbn0gZnJvbSAncm9hcCdcbmltcG9ydCB7aXRlciwgc3RlcF9pdGVyLCBhb19pdGVyLCBhb19zdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmRlc2NyaWJlIEAgJ3Ntb2tlJywgQDo6XG4gIGl0IEAgJ2RlZmVycmVkJywgQDo6XG4gICAgaXNfZm4gQCBhb19kZWZlcnJlZFxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG4gICAgaXNfZm4gQCBhb19mZW5jZV9pblxuXG4gIGl0IEAgJ2RyaXZlJywgQDo6XG4gICAgaXNfZm4gQCBpdGVyXG4gICAgaXNfZm4gQCBzdGVwX2l0ZXJcbiAgICBpc19mbiBAIGFvX2l0ZXJcbiAgICBpc19mbiBAIGFvX3N0ZXBfaXRlclxuICAgIFxuICAgIGlzX2ZuIEAgYW9fcnVuXG4gICAgaXNfZm4gQCBhb19kcml2ZVxuXG4gIGl0IEAgJ3NwbGl0JywgQDo6XG4gICAgaXNfZm4gQCBhb19zcGxpdFxuICAgIGlzX2ZuIEAgYW9fdGFwXG5cbiIsImltcG9ydCB7YW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVycmVkJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWRfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZF92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG5cblxuICBkZXNjcmliZSBAICdhb19kZWZlcnJlZCBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1bihnKVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3RcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBnX3RndC5uZXh0KCdmaW5hbCcpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgICdzZWNvbmQnXG4gICAgICAxOTQyXG4gICAgICAyMDQyXG4gICAgICAyMTQyXG4gICAgICAnZmluYWwnXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KGxzdCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4gIGl0IEAgJ2FvX2RyaXZlIGZ1bmN0aW9uJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdlbl90ZXN0XG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgIDE5NDJcbiAgICAgIDIwNDJcbiAgICAgIDIxNDJcblxuICAgIGZ1bmN0aW9uICogZ2VuX3Rlc3QoKSA6OlxuICAgICAgd2hpbGUgMSA6OlxuICAgICAgICBsZXQgdiA9IHlpZWxkXG4gICAgICAgIGxzdC5wdXNoKHYpXG5cbiIsImltcG9ydCB7aXRlciwgYW9faXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3RlcF9pdGVyLCBzdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZ2VuXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZSBpdGVycycsIEA6OlxuXG4gIGl0IEAgJ25vcm1hbCBpdGVyJywgQDo6XG4gICAgbGV0IGcgPSBpc19nZW4gQCBpdGVyIEAjIDEwLCAyMCwgMzBcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBnLm5leHQoKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlcicsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX2l0ZXIgQCMgMTAsIDIwLCAzMFxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGF3YWl0IHBcblxuXG4gIGl0IEAgJ25vcm1hbCBzdGVwX2l0ZXInLCBAOjpcbiAgICBsZXQgeiA9IEFycmF5LmZyb20gQFxuICAgICAgemlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG4gICAgZnVuY3Rpb24gKiB6aXAoYSwgYikgOjpcbiAgICAgIGIgPSBzdGVwX2l0ZXIoYilcbiAgICAgIGZvciBsZXQgYXYgb2YgaXRlcihhKSA6OlxuICAgICAgICBmb3IgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG5cbiAgaXQgQCAnYXN5bmMgYW9fc3RlcF9pdGVyJywgQDo6PlxuICAgIGxldCB6ID0gYXdhaXQgYXJyYXlfZnJvbV9hb19pdGVyIEBcbiAgICAgIGFvX3ppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuXG4gICAgYXN5bmMgZnVuY3Rpb24gKiBhb196aXAoYSwgYikgOjpcbiAgICAgIGIgPSBhb19zdGVwX2l0ZXIoYilcbiAgICAgIGZvciBhd2FpdCBsZXQgYXYgb2YgYW9faXRlcihhKSA6OlxuICAgICAgICBmb3IgYXdhaXQgbGV0IGJ2IG9mIGIgOjpcbiAgICAgICAgICB5aWVsZCBbYXYsIGJ2XVxuXG4iLCJpbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBzcGxpdCcsIEA6OlxuXG4gIGl0IEAgJ2FvX3NwbGl0IHRyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLndoZW5fcnVuKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjA0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMTQyKVxuXG4gICAgICBhd2FpdCBncy53aGVuX3J1blxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cblxuICBpdCBAICdhb190YXAgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBbZl9vdXQsIGFnX3RhcF0gPSBhb190YXAoZylcbiAgICAgIGlzX2FzeW5jX2l0ZXJhYmxlIEAgZl9vdXRcbiAgICAgIGlzX2dlbiBAIGFnX3RhcFxuXG4gICAgICBleHBlY3QoZl9vdXQuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBmX291dC5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0LmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGZfb3V0KVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl9vdXQuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoYWdfdGFwKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YXNzZXJ0LCBleHBlY3QsIGRlbGF5X3JhY2V9IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV92IHR1cGxlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3YoKVxuICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdvbmx5IGZpcnN0IGFmdGVyJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuICAgIGxldCBmXG5cbiAgICByZXN1bWUgQCAnb25lJ1xuICAgIGYgPSBmZW5jZSgpXG4gICAgcmVzdW1lIEAgJ3R3bydcbiAgICByZXN1bWUgQCAndGhyZWUnXG5cbiAgICBhc3NlcnQuZXF1YWwgQCAndHdvJywgYXdhaXQgZlxuXG4gICAgcmVzdW1lIEAgJ2ZvdXInXG4gICAgcmVzdW1lIEAgJ2ZpdmUnXG4gICAgZiA9IGZlbmNlKClcbiAgICByZXN1bWUgQCAnc2l4J1xuICAgIHJlc3VtZSBAICdzZXZlbidcblxuICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG5cblxuICBpdCBAICduZXZlciBibG9ja2VkIG9uIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgcmVzdW1lIEAgJ29uZSdcbiAgICByZXN1bWUgQCAndHdvJ1xuICAgIHJlc3VtZSBAICd0aHJlZSdcblxuXG4gIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgbGV0IHYgPSAnYSdcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgY29uc3QgcCA9IEAhPlxuICAgICAgdiA9ICdiJ1xuXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnYmInKVxuXG4gICAgICB2ID0gJ2MnXG4gICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnY2MnKVxuICAgICAgdiA9ICdkJ1xuICAgICAgcmV0dXJuIDE5NDJcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdiJylcblxuICAgIDo6XG4gICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2MnKVxuXG4gICAgOjpcbiAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICBleHBlY3QodikudG8uZXF1YWwoJ2QnKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2ZufSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthc3NlcnQsIGV4cGVjdCwgaXNfZmVuY2VfYmFzaWMsIGRlbGF5X3JhY2UsIGRlbGF5fSBmcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfZm4nLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpc19mZW5jZV9iYXNpYyhyZXNbMF0pXG5cblxuICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzdW1lKDE5NDIpXG4gICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV9mbigpXG5cbiAgICBkZWxheSgpLnRoZW4gQD0+IHJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIGZlbmNlIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UuYW9fZm9yaygpIDo6XG4gICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgIGxldCBwYyA9IGZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthc3NlcnQsIGV4cGVjdCwgaXNfZmVuY2VfZnVsbCwgZGVsYXlfcmFjZSwgZGVsYXl9IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9vYmonLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfZnVsbCBAIGFvX2ZlbmNlX29iaigpXG4gICAgZXhwZWN0KHJlcy5hb19nYXRlZCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgaXQgQCAnYmFzaWMgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzLnJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgIGRlbGF5KCkudGhlbiBAPT4gcmVzLnJlc3VtZSgncmVhZHknKVxuXG4gICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgdlxuICAgICAgYnJlYWtcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICBsZXQgcGEgPSBAIT5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgcmV0dXJuIGBwYSAke3Z9YFxuXG4gICAgbGV0IHBiID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICByZXR1cm4gYHBiICR7dn1gXG5cbiAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICByZXMucmVzdW1lKCdyZWFkeScpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW59IGZyb20gJ3JvYXAnXG5pbXBvcnQge2Fzc2VydCwgZXhwZWN0LCBpc19mZW5jZV9mdWxsLCBkZWxheV9yYWNlLCBkZWxheX0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgY29uc3QgcmVzID0gaXNfZmVuY2VfZnVsbCBAIGFvX2ZlbmNlX2luKClcblxuICAgIGV4cGVjdChyZXMuYW9feGZvcm1fdGFwKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHJlcy5hb194Zm9ybV9ydW4pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICBleHBlY3QocmVzLmFvX3hmb3JtX3JhdykudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgZXhwZWN0KHJlcy5hb19xdWV1ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9nX3NpbmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGV4cGVjdChyZXMuYW9fcGlwZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChyZXMuYW9nX2l0ZXIpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuXG4gIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICBjb25zdCByZXMgPSBhb19mZW5jZV9pbigpXG5cbiAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgcmVzLnJlc3VtZSgxOTQyKVxuICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzdW1lKCdyZWFkeScpXG5cbiAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICBicmVha1xuXG5cbiAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgY29uc3QgcmVzID0gYW9fZmVuY2VfaW4oKVxuXG4gICAgbGV0IHBhID0gQCE+XG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgIGxldCBwYiA9IEAhPlxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcy5hb19mb3JrKCkgOjpcbiAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgcmVzLnJlc3VtZSgncmVhZHknKVxuICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICBhc3NlcnQuZXF1YWwgQCAncGIgcmVhZHknLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX2luLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2luLmFvX3F1ZXVlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBzb21lX3F1ZXVlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19xdWV1ZSgpXG5cbiAgICBpc19nZW4oc29tZV9xdWV1ZS5nX2luKVxuICAgIGV4cGVjdChzb21lX3F1ZXVlLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgZXhwZWN0KHNvbWVfcXVldWUud2hlbl9ydW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gIGl0IEAgJ3NpbmdsZXMnLCBAOjo+XG4gICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9pbigpLmFvX3F1ZXVlKClcblxuICAgIGxldCBwX291dDEgPSBzb21lX3F1ZXVlLmZlbmNlKClcbiAgICBleHBlY3QocF9vdXQxKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwX2luMSA9IHNvbWVfcXVldWUuZ19pbi5uZXh0IEAgJ2ZpcnN0J1xuICAgIGV4cGVjdChwX2luMSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBleHBlY3QoYXdhaXQgcF9vdXQxKS50by5lcXVhbCBAICdmaXJzdCdcblxuICBpdCBAICd2ZWMnLCBAOjo+XG4gICAgbGV0IHNvbWVfcXVldWUgPSBhb19mZW5jZV9pbigpLmFvX3F1ZXVlIEA6XG4gICAgICBhc3luYyAqIHhyZWN2KGcpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgeWllbGQgMTAwMCt2XG5cbiAgICBsZXQgb3V0ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcXVldWUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrIEAjIDI1LCA1MCwgNzUsIDEwMFxuICAgICAgc29tZV9xdWV1ZS5nX2luXG5cbiAgICBhd2FpdCBzb21lX3F1ZXVlLmdfaW4ucmV0dXJuKClcblxuICAgIGV4cGVjdChhd2FpdCBvdXQpLnRvLmRlZXAuZXF1YWwgQCNcbiAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19mZW5jZV9pbiwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZV9pbi5hb19waXBlIGJhc2ljcycsIGZ1bmN0aW9uKCkgOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBsZXQgc29tZV9waXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZmVuY2VfaW4oKS5hb19waXBlKClcblxuICAgIGlzX2dlbiBAIHNvbWVfcGlwZS5nX2luXG4gICAgZXhwZWN0KHNvbWVfcGlwZS5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgIGV4cGVjdChzb21lX3BpcGUud2hlbl9ydW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gIGl0IEAgJ2V4YW1wbGUnLCBAOjo+XG4gICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcGlwZSgpXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19waXBlIEA6XG4gICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgcyArPSB2XG4gICAgICAgICAgeWllbGQgc1xuXG4gICAgbGV0IHogPSBfdGVzdF9waXBlX291dCBAIHNvbWVfcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0JywgQDo6PlxuICAgIGxldCBzb21lX3BpcGUgPSBhb19mZW5jZV9pbigpLmFvX3BpcGUgQDpcbiAgICAgIGFzeW5jICogeGVtaXQoZykgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICAgICAgICB5aWVsZCBbJ3hlJywgdl1cblxuICAgIGxldCB6ID0gX3Rlc3RfcGlwZV9vdXQgQCBzb21lX3BpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGFzeW5jIGZ1bmN0aW9uIF90ZXN0X3BpcGVfb3V0KHNvbWVfcGlwZSwgdmFsdWVzKSA6OlxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgIGF3YWl0IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsodmFsdWVzKVxuICAgICAgc29tZV9waXBlLmdfaW4sIHRydWVcblxuICAgIHJldHVybiB6XG5cbiIsImltcG9ydCB7YW9fZmVuY2VfaW4sIGFvX2RyaXZlLCBhb19ydW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fZmVuY2VfaW4uYW9fcGlwZSBhZHZhbmNlZCcsIGZ1bmN0aW9uKCkgOjpcbiAgZGVzY3JpYmUgQCAnY29tcHV0ZScsIEA6OlxuICAgIGl0IEAgJ3hmb2xkJywgQDo6PlxuICAgICAgbGV0IHNvbWVfcGlwZSA9IGFvX2ZlbmNlX2luKCkuYW9fcGlwZSBAOlxuICAgICAgICAqeHJlY3YoZykgOjpcbiAgICAgICAgICBmb3IgbGV0IHYgb2YgZyA6OlxuICAgICAgICAgICAgeWllbGQgdiArIDEwMDBcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoc29tZV9waXBlKVxuXG4gICAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgc29tZV9waXBlLmdfaW4sIHRydWVcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAxMDMwLCAxMDIwLCAxMDEwXG5cblxuICAgIGl0IEAgJyp4Z2ZvbGQnLCBAOjo+XG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19waXBlIEA6XG4gICAgICAgICp4cmVjdihnKSA6OlxuICAgICAgICAgIGxldCBzID0gMFxuICAgICAgICAgIGZvciBsZXQgdiBvZiBnIDo6XG4gICAgICAgICAgICBzICs9IHYgKyAxMDAwXG4gICAgICAgICAgICB5aWVsZCBzXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHNvbWVfcGlwZSlcblxuICAgICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgIHNvbWVfcGlwZS5nX2luLCB0cnVlXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMTAzMCwgMjA1MCwgMzA2MFxuXG5cbiAgICBpdCBAICd4Y3R4JywgQDo6PlxuICAgICAgbGV0IGxvZz1bXVxuXG4gICAgICBsZXQgc29tZV9waXBlID0gYW9fZmVuY2VfaW4oKS5hb19waXBlIEA6XG4gICAgICAgICp4aW5pdChnX2luKSA6OlxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggc3RhcnQnXG4gICAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgICAxLCAnYmluZ28nXG5cbiAgICAgICAgICB0cnkgOjpcbiAgICAgICAgICAgIHlpZWxkICogZ19pbi5hb2dfaXRlcigpXG4gICAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihzb21lX3BpcGUpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgICAgYXdhaXQgZGVsYXkoNSlcbiAgICAgIHNvbWVfcGlwZS5nX2luLnJldHVybigpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBkZXNjcmliZSBAICdvdXRwdXQgYXN5bmMgZ2VuZXJhdG9yJywgQDo6XG4gICAgaXQgQCAncmF3JywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfZ2VuIEBcbiAgICAgICAgYW9fZmVuY2VfaW4oKS5hb194Zm9ybV9yYXcoKVxuXG4gICAgICBsZXQgdjAgPSBncy5uZXh0KClcbiAgICAgIGV4cGVjdCh2MCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwZCA9IGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICBncy5nX2luLCB0cnVlXG5cbiAgICAgIGxldCBwciA9IGFvX3J1bihncylcbiAgICAgIGV4cGVjdChwcikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYXdhaXQgcHIpLnRvLmJlLnVuZGVmaW5lZFxuICAgICAgZXhwZWN0KGF3YWl0IHBkKS50by5iZS51bmRlZmluZWRcblxuICAgICAgbGV0IHYxID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYXdhaXQgdjApLnRvLmRlZXAuZXF1YWwgQDogdmFsdWU6IDMwLCBkb25lOiBmYWxzZVxuICAgICAgZXhwZWN0KGF3YWl0IHYxKS50by5kZWVwLmVxdWFsIEA6IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWVcblxuXG4gICAgaXQgQCAndGFwJywgQDo6PlxuICAgICAgbGV0IFtmX3RhcCwgYWdfdGFwXSA9IGFvX2ZlbmNlX2luKCkuYW9feGZvcm1fdGFwKClcblxuICAgICAgaXNfYXN5bmNfaXRlcmFibGUoZl90YXApXG4gICAgICBpc19nZW4oYWdfdGFwKVxuICAgICAgaXNfZ2VuKGZfdGFwLmdfaW4pXG4gICAgICBpc19nZW4oYWdfdGFwLmdfaW4pXG4gICAgICBhc3NlcnQgQCBmX3RhcC5nX2luID09PSBhZ190YXAuZ19pbiwgXCJoYXMgc2FtZSBnX2luXCJcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl90YXAuYW9fZm9yaygpKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZl90YXAuYW9fZm9yaygpKVxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihmX3RhcClcbiAgICAgIGV4cGVjdChmX3RhcC5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBhb19kcml2ZSBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgZl90YXAuZ19pbiwgdHJ1ZVxuXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoeikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGF3YWl0IGFvX3J1bihhZ190YXApXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBhKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBiKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcblxuXG4gICAgaXQgQCAnc3BsaXQnLCBAOjo+XG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX2ZlbmNlX2luKCkuYW9feGZvcm1fcnVuKClcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcblxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QoZ3Mud2hlbl9ydW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoeikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFvX2RyaXZlIEBcbiAgICAgICAgZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuICAgICAgICBncy5nX2luLCB0cnVlXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHApLnRvLmVxdWFsIEAgMzBcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGEpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGIpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuXG4iLCJpbXBvcnQge2FvX2ludGVydmFsLCBhb190aW1lb3V0LCBhb19kZWJvdW5jZSwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAndGltZScsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9faW50ZXJ2YWxcbiAgICBpc19mbiBAIGFvX3RpbWVvdXRcbiAgICBpc19mbiBAIGFvX3RpbWVzXG5cblxuICBpdCBAICdhb19pbnRlcnZhbCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9faW50ZXJ2YWwoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX3RpbWVvdXQnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX3RpbWVvdXQoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuXG4gIGl0IEAgJ2FvX2RlYm91bmNlJywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb19kZWJvdW5jZSgxMCwgWzMwLCAyMCwgMTAsIDE1XSlcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgZXhwZWN0KGFvdC5maW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGFzc2VydC5lcXVhbCgxNSwgdmFsdWUpXG5cbiAgICBhd2FpdCBhb3QuZmluXG5cblxuICBpdCBAICdhb19pbnRlcnZhbCBhcyByYXRlIGxpbWl0JywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEBcbiAgICAgIGFvX2ludGVydmFsKDEwLCBbMzAsIDIwLCAxMCwgMTVdKVxuXG4gICAgbGV0IHAgPSBnLm5leHQoKVxuICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgIGV4cGVjdCh2YWx1ZSkudG8uZXF1YWwoMzApXG5cbiAgICBsZXQgbHN0ID0gW3ZhbHVlXVxuICAgIGZvciBhd2FpdCBsZXQgdiBvZiBnIDo6XG4gICAgICBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KGxzdCkudG8uZGVlcC5lcXVhbCBAXG4gICAgICBbMzAsIDIwLCAxMCwgMTVdXG5cblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fZG9tX2FuaW1hdGlvbiwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGFuaW1hdGlvbiBmcmFtZXMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9hbmltYXRpb25cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA6OlxuXG4gICAgaXQgQCAnYW9fZG9tX2FuaW1hdGlvbicsIEA6Oj5cbiAgICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9hbmltYXRpb24oKVxuICAgICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodmFsdWUgPj0gMClcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG5cbiAgICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19kb21fYW5pbWF0aW9uKClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19kb21fbGlzdGVufSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheSxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgYXJyYXlfZnJvbV9hb19pdGVyXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGV2ZW50cycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2xpc3RlblxuXG4gICAgbGV0IGRlID0gaXNfZ2VuIEAgYW9fZG9tX2xpc3RlbigpXG4gICAgaXNfZ2VuIEAgZGUuZ19pblxuICAgIGlzX2ZuIEAgZGUud2l0aF9kb21cblxuXG4gIGl0IEAgJ3NoYXBlIG9mIHdpdGhfZG9tJywgQDo6XG4gICAgbGV0IG1vY2sgPSBAe31cbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIoZXZ0LCBmbiwgb3B0KSA6OlxuXG4gICAgbGV0IGVfY3R4ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICAud2l0aF9kb20obW9jaylcblxuICAgIGlzX2ZuIEAgZV9jdHgud2l0aF9kb21cbiAgICBpc19mbiBAIGVfY3R4Lmxpc3RlblxuXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA6OlxuXG4gICAgaXQgQCAnbWVzc2FnZSBjaGFubmVscycsIEA6Oj5cbiAgICAgIGNvbnN0IHtwb3J0MSwgcG9ydDJ9ID0gbmV3IE1lc3NhZ2VDaGFubmVsKClcblxuICAgICAgY29uc3QgYW9fdGd0ID0gYW9fZG9tX2xpc3RlbigpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihhb190Z3QpXG5cbiAgICAgIGFvX3RndFxuICAgICAgICAud2l0aF9kb20gQCBwb3J0Miwgdm9pZCBwb3J0Mi5zdGFydCgpXG4gICAgICAgIC5saXN0ZW4gQCAnbWVzc2FnZScsIGV2dCA9PiBAOiB0ZXN0X25hbWU6IGV2dC5kYXRhXG5cbiAgICAgIDo6IT5cbiAgICAgICAgZm9yIGxldCBtIG9mIFsnYScsICdiJywgJ2MnXSA6OlxuICAgICAgICAgIHBvcnQxLnBvc3RNZXNzYWdlIEAgYGZyb20gbXNnIHBvcnQxOiAke219YFxuICAgICAgICAgIGF3YWl0IGRlbGF5KDEpXG5cbiAgICAgICAgYW9fdGd0LmdfaW4ucmV0dXJuKClcblxuICAgICAgbGV0IGV4cGVjdGVkID0gQFtdXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYSdcbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBiJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGMnXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsKGV4cGVjdGVkKVxuXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0VBQUEsbUNBQW1DLE1BQU07OztJQUl2QyxZQUFhO01BQ1gsV0FBWSxPQUFROzs7SUFHdEIsY0FBZTs7O0lBR2Y7ZUFDUztNQUNQO01BQ0E7OztJQUdGLG1CQUFtQixVQUFVO0lBQzdCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBO0lBQ0E7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBOzs7SUFHQSxPQUFRLGlDQUFrQztJQUMxQzs7O0lBR0E7ZUFDUztNQUNQO0lBQ0Y7O0VDckRGLE1BQU0sVUFBVSxHQUFHLENBQUM7RUFDcEIsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUNsQztFQUNBLE1BQU0sUUFBUSxHQUFHLElBQUk7RUFDckIsRUFBRSxV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QUMsQ0FBQztBQUMzQjtFQUNBLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxFQUFFO0VBQ3JCLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRTtBQUNqQztBQUNBO0VBQ0EsU0FBUyxZQUFZLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUU7RUFDdEMsRUFBRSxJQUFJLE9BQU8sQ0FBQztFQUNkLEVBQUUsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUU7RUFDcEIsSUFBSSxTQUFTLENBQUMsSUFBSTtFQUNsQixNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMxQztFQUNBLEVBQUUsT0FBTztFQUNULElBQUksU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJO0VBQ3pCLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxFQUFFO0VBQ3BCLE1BQU0sSUFBSSxHQUFHLEVBQUUsTUFBTSxHQUFHLE9BQU8sQ0FBQztBQUNoQztFQUNBLE1BQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0VBQzVCLE1BQU0sSUFBSSxVQUFVLEtBQUssT0FBTyxJQUFJLEVBQUU7RUFDdEMsUUFBUSxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7RUFDM0MsUUFBUSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDM0I7RUFDQSxNQUFNLElBQUksUUFBUSxLQUFLLE9BQU8sSUFBSSxFQUFFO0VBQ3BDLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0VBQ3pCLFdBQVcsR0FBRyxHQUFHLElBQUksQ0FBQztBQUN0QjtFQUNBLE1BQU0sS0FBSyxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7RUFDNUIsUUFBUSxHQUFH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
