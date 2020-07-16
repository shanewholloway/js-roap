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
    assert.equal('function', typeof fn);
    return fn}

  function is_gen(g) {
    is_fn(g.next);
    is_fn(g.return);
    is_fn(g.throw);
    return g}

  function is_async_iterable(o) {
    assert(null != o[Symbol.asyncIterator], 'async iterable');
    return o}

  async function array_from_ao_iter(g) {
    let res = [];
    for await (let v of g) {
      res.push(v);}
    return res}

  const {
    assign: _obj_assign,
    defineProperties: _obj_props,
  } = Object;

  const is_ao_iter = g =>
    null != g[Symbol.asyncIterator];

  const _is_fn = v_fn =>
    'function' === typeof v_fn
      && ! is_ao_iter(v_fn);
  const _ret_ident = v => v;

  const _xinvoke = v_fn =>
    _is_fn(v_fn)
      ? v_fn()
      : v_fn;

  function _xpipe_tgt(pipe) {
    if (_is_fn(pipe)) {
      pipe = pipe();
      pipe.next();
      return pipe}

    return pipe.g_in || pipe}
  function * iter(gen_in) {
    yield * _xinvoke(gen_in);}
  async function * ao_iter(gen_in) {
    yield * _xinvoke(gen_in);}


  function fn_chain(tail, ctx) {
    return _obj_assign(chain, {chain, tail})
    function chain(fn) {
      chain.tail = fn(chain.tail, ctx);
      return chain} }

  const ao_deferred_v = ((() => {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , [p, y, n]) })());

  const ao_deferred = v =>(
    v = ao_deferred_v()
  , {promise: v[0], resolve: v[1], reject: v[2]});

  const ao_sym_done = Symbol('ao_done');

  function ao_fence_v() {
    let p=0, _resume = ()=>{};
    let _pset = a => _resume = a;

    return [
      () => 0 !== p ? p
        : p = new Promise(_pset)

    , v => {p = 0; _resume(v);} ] }



  const _ao_fence_api ={
    stop() {this.fence.done = true;}

  , ao_fork() {
      return ao_fence_fork(this.fence)}

  , [Symbol.asyncIterator]() {
      return this.ao_fork()} };

  function ao_fence_fn(tgt) {
    let f = ao_fence_v();
    if (undefined === tgt) {tgt = f[0];}
    tgt.fence = _obj_assign(tgt, _ao_fence_api);
    return f}

  function ao_fence_obj(tgt) {
    let f = ao_fence_fn(tgt);
    return {__proto__: _ao_fence_api
    , fence: tgt || f[0], reset: f[1]} }


  async function * ao_fence_fork(fence) {
    while (! fence.done) {
      let v = await fence();
      if (fence.done || v === ao_sym_done) {
        return v}
      yield v;} }


  async function * _ao_fence_loop(fence, reset, xform) {
    try {
      let v;
      while (! fence.done) {
        v = await fence();
        if (v === ao_sym_done) {
          return}

        v = yield v;
        if (undefined !== xform) {
          v = await xform(v);}
        reset(v); } }
    finally {
      reset(ao_sym_done);} }

  async function ao_run(gen_in, notify=_ret_ident) {
    for await (let v of _xinvoke(gen_in)) {
      notify(v);} }


  async function ao_drive(gen_in, gen_tgt, xform=_ret_ident) {
    gen_tgt = _xpipe_tgt(gen_tgt);
    for await (let v of _xinvoke(gen_in)) {
      if (undefined !== gen_tgt) {
        v = xform(v);
        let {done} = await gen_tgt.next(v);
        if (done) {break} } } }


  function ao_step_iter(iterable, multiple) {
    iterable = ao_iter(iterable);
    return {
      async * [Symbol.asyncIterator]() {
        do {
          let {value} = await iterable.next();
          yield value;}
        while (multiple) } } }


  function step_iter(iterable, multiple) {
    iterable = iter(iterable);
    return {
      *[Symbol.iterator]() {
        do {
          let {value} = iterable.next();
          yield value;}
        while (multiple) } } }

  function ao_fork() {
    return ao_fence_fork(this.fence)}

  const _ao_tap_props ={
    ao_fork:{value: ao_fork}
  , chain:{get() {
      return fn_chain(this, this)} } };

  function ao_tap(ag_out) {
    return _obj_props(_ao_tap(ag_out), _ao_tap_props) }

  function _ao_tap(ag_out) {
    let [fence, reset] = ao_fence_v();
    let gen = ((async function * () {
      fence.done = false;
      try {
        for await (let v of _xinvoke(ag_out)) {
          reset(v);
          yield v;} }
      finally {
        fence.done = true;
        reset();} }).call(this));

    gen.fence = fence;
    return gen}



  const _ao_split_api ={
    get chain() {
      return fn_chain(this, this)}
  , [Symbol.asyncIterator]: ao_fork
  , ao_fork};

  function ao_split(ag_out) {
    let gen = _ao_tap(ag_out);
    return {
      __proto__: _ao_split_api
    , fin: ao_run(gen)
    , fence: gen.fence} }

  function ao_queue(xform) {
    let [fence, out_reset] = ao_fence_fn();
    let [in_fence, in_reset] = ao_fence_v();

    let ag_out = _ao_fence_loop(fence, in_reset);
    let g_in = _ao_fence_loop(in_fence, out_reset, xform);

    // allow g_in to initialize
    g_in.next() ; in_reset();
    return _obj_assign(ag_out, {fence, g_in}) }

  const _as_pipe_end = (g,ns) => _obj_assign(g, ns);

  //~~~
  // Pipe base as generator in composed object-functional implementation

  const _ao_pipe_base ={
    xfold: v => v // on push: identity transform
  , xpull() {} // memory: none
  , xemit: _xinvoke // identity transform or invoke if function
  , xinit(g_in, ag_out) {} // on init: default behavior

  , get create() {
      // as getter to bind class as `this` at access time
      const create = (... args) =>
        _obj_assign({__proto__: this},
          ... args.map(_xinvoke))
        ._ao_pipe();

      return create.create = create}

  , _ao_pipe() {
      let fin_lst = [];

      let on_fin = this.on_fin =
        g =>(fin_lst.push(g), g);

      let stop = this.stop = (() => {
        this.done = true;
        _fin_pipe(fin_lst);
        this._resume();});


      let g_in = on_fin(
        this._ao_pipe_in());

      let ag_out = on_fin(
        this._ao_pipe_out());

      // adapt ag_out by api and kind
      let self = {stop, on_fin, g_in};
      ag_out = this._as_pipe_out(
        ag_out, self, this.kind);

      ag_out = this.xinit(g_in, ag_out) || ag_out;

      // allow g_in to initialize
      g_in.next();
      return ag_out}

  , _as_pipe_out: _as_pipe_end

  , //~~~
    // Upstream input generator
    //   designed for multiple feeders

    *_ao_pipe_in() {
      try {
        let v;
        while (! this.done) {
          v = this.xfold(yield v);
          this.value = v;
          if (0 !== this._waiting && undefined !== v) {
            this._resume();} } }

      finally {
        this.stop();} }


  , //~~~
    // Downstream async output generator
    //   designed for single consumer.

    async *_ao_pipe_out() {
      try {
        let r;
        while (! this.done) {
          if (0 !== (r = this._waiting)) {
            // p0: existing waiters
            r = await r;
            if (this.done) {break} }
          else if (undefined !== (r = this.value)) {
            // p1: available value
            this.value = undefined;}
          else if (undefined !== (r = this.xpull())) {
            }// p2: xpull value (e.g. queue memory) 
          else {
            // p3: add new waiter
            r = await this._bind_waiting();
            if (this.done) {break} }

          yield this.xemit(r);} }

      finally {
        this.stop();} }


  , //~~~
    // generator-like value/done states

    value: undefined
  , done: false

  , //~~~
    // promise-based fence tailored for ao_pipe usecase

    _waiting: 0
  , _fulfill() {}
  , async _resume() {
      if (! this.done) {await this;}

      let {value, _fulfill} = this;
      if (undefined != value || this.done) {
        this.value = undefined;
        this._waiting = 0;
        _fulfill(value);} }

  , _bind_waiting() {
      let _reset = y => this._fulfill = y;
      this._bind_waiting = () => this._waiting ||(
        this._waiting = new Promise(_reset));
      return this._bind_waiting()} };


  function _fin_pipe(fin_lst) {
    while (0 !== fin_lst.length) {
      let g = fin_lst.pop();
      try {
        if (_is_fn(g)) {g();}
        else g.return();}
      catch (err) {
        if (err instanceof TypeError) {
          if ('Generator is already running' === err.message) {
            continue} }
        console.error(err);} } }

  const _ao_pipe_out_kinds ={
    ao_raw: g => g
  , ao_split: ao_split
  , ao_tap: ao_tap};

  function _ao_pipe_out(ag_out, self, kind) {
    kind = /^ao_/.test(kind) ? kind : 'ao_'+kind;
    let ao_wrap = _ao_pipe_out_kinds[kind];
    if (undefined === ao_wrap) {
      throw new Error(`Unknonwn ao_pipe_out kind "${kind}"`)}

    return _obj_assign(ao_wrap(ag_out), self) }

  const _ao_pipe ={
    __proto__: _ao_pipe_base

  , // xfold: v => v -- on push: identity transform
    // xpull() {} -- memory: none
    // xemit: _xinvoke -- identity transform or invoke if function

    // *xgfold() -- on push: generator-based fold impl
    // *xsrc() -- feed with source generator
    // *xctx(gen_src) -- on init: bind event sources

    kind: 'split'
  , //_as_pipe_in: _ao_pipe_in
    _as_pipe_out: _ao_pipe_out

  , xinit(g_in, ag_out) {
      let xgfold = this.xgfold;
      if (undefined !== xgfold) {
        this._init_xgfold(g_in, xgfold);}

      this._init_chain(g_in);}


  , _init_xgfold(g_in, xgfold) {
      if (undefined === xgfold) {
        return}

      if (_is_fn(xgfold)) {
        xgfold = xgfold.call(this, this);

        if (_is_fn(xgfold)) {
          this.xfold = xgfold;
          return true}

        xgfold.next();}

      this.xgfold = xgfold;
      this.xfold = this._fold_gen;
      this.on_fin(xgfold);
      return true}

  , _fold_gen(v) {
      let {done, value} = this.xgfold.next(v);
      if (done) {this.done = true;}
      return value}


  , _init_chain(g_in) {
      let {xsrc, xctx} = this;
      if (undefined !== xsrc) {
        ao_drive(xsrc, g_in)
          .then (() =>g_in.return()); }

      if (undefined !== xctx) {
        this._with_ctx(g_in, xctx);} }

  , _with_ctx(g_in, xctx) {
      if (_is_fn(xctx)) {
        xctx = xctx(g_in);}

      if (xctx && xctx.next) {
        xctx.next(g_in);
        this.on_fin(xctx);}
      return xctx} };

  const ao_pipe = _ao_pipe.create;

  function ao_interval(ms=1000) {
    let [_fence, _reset] = ao_fence_fn();
    let tid = setInterval(_reset, ms, 1);
    if (tid.unref) {tid.unref();}
    _fence.stop = (() => {
      tid = clearInterval(tid);
      _fence.done = true;});
    return _fence}


  function ao_timeout(ms=1000) {
    let tid, [_fence, _reset] = ao_fence_fn(timeout);
    return timeout

    function timeout() {
      tid = setTimeout(_reset, ms, 1);
      if (tid.unref) {tid.unref();}
      return _fence()} }


  function ao_debounce(ms=300, gen_in) {
    let tid, [_fence, _reset] = ao_fence_fn();

    _fence.fin = ((async () => {
      let p;
      for await (let v of _xinvoke(gen_in)) {
        clearTimeout(tid);
        if (_fence.done) {return}
        p = _fence();
        tid = setTimeout(_reset, ms, v);}

      await p;
      _fence.done = true;})());

    return _fence}


  async function * ao_times(gen_in) {
    let ts0 = Date.now();
    for await (let v of gen_in) {
      yield Date.now() - ts0;} }

  function ao_dom_animation() {
    let tid, [_fence, _reset] = ao_fence_fn(raf);
    raf.stop = (() => {
      tid = cancelAnimationFrame(tid);
      raf.done = true;});
    return raf

    function raf() {
      tid = requestAnimationFrame(_reset);
      return _fence()} }

  const _evt_init = Promise.resolve({type:'init'});
  function ao_dom_listen(pipe = ao_queue()) {
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
    if (_is_fn(fn)) {
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
      is_fn(ao_fence_obj); }) );

    it('drive', (() => {
      is_fn(iter);
      is_fn(step_iter);
      is_fn(ao_iter);
      is_fn(ao_step_iter);

      is_fn(ao_run);
      is_fn(ao_drive); }) );

    it('split', (() => {
      is_fn(ao_split);
      is_fn(ao_tap); }) );

    it('pipe', (() => {
      is_fn(ao_pipe); }) ); }) );

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
      let lst = [];
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_run(g, v => lst.push(v));

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);
      assert.deepEqual(lst,[1942, 2042, 2142]); }) );

    it('ao_drive generator', (async () => {
      let lst = [];
      let g_tgt = gen_test(lst);
      g_tgt.next('first');
      g_tgt.next('second');
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, g_tgt, v => ['xe', v]);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);
      g_tgt.next('final');

      assert.deepEqual(lst,[
        'second'
      , ['xe', 1942]
      , ['xe', 2042]
      , ['xe', 2142]
      , 'final'] );

      function * gen_test(lst) {
        while (1) {
          let v = yield;
          lst.push(v);} } }) );

    it('ao_drive function', (async () => {
      let lst = [];
      let g = delay_walk([1942, 2042, 2142]);
      let p = ao_drive(g, gen_test, v => ['xe', v]);

      expect(p).to.be.a("promise");
      assert.deepEqual(await p, undefined);

      assert.deepEqual(lst,[
        ['xe', 1942]
      , ['xe', 2042]
      , ['xe', 2142] ] );

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

        expect(gs.fin).to.be.a('promise');
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

        await gs.fin;
        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) );


    it('ao_tap triple', (async () => {
        let g = delay_walk([1942, 2042, 2142]);
        let gs = is_async_iterable(ao_tap(g));

        expect(gs.fence).to.be.a('function');

        let p = gs.fence();
        expect(p).to.be.a('promise');

        let a = array_from_ao_iter(gs.ao_fork());
        expect(a).to.be.a('promise');
        let b = array_from_ao_iter(gs.ao_fork());
        expect(b).to.be.a('promise');
        let c = array_from_ao_iter(gs.ao_fork());
        expect(c).to.be.a('promise');

        assert.equal('timeout', await delay_race(p,1));
        let z = array_from_ao_iter(gs);

        assert.equal(await p, 1942);

        assert.deepEqual(a = await a,[1942, 2042, 2142]);
        assert.deepEqual(b = await b,[1942, 2042, 2142]);
        assert.deepEqual(c = await c,[1942, 2042, 2142]);

        assert(a !== b);
        assert(a !== c);
        assert(b !== c); }) ); }) );

  describe('ao_fence', (() => {
    describe('ao_fence_v tuple', (() => {
      it('shape', (() => {
        const res = ao_fence_v();
        expect(res).to.be.an('array').of.length(2);
        expect(res[0]).to.be.a('function');
        expect(res[1]).to.be.a('function');}) );


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
        expect(v).to.equal('d');}) ); }) );


    describe('ao_fence_fn', (() => {
      it('shape', (() => {
        const res = ao_fence_fn();

        expect(res).to.be.an('array').of.length(2);
        expect(res[0]).to.be.a('function');
        expect(res[1]).to.be.a('function');
        expect(res[0].ao_fork).to.be.a('function');
        expect(res[0][Symbol.asyncIterator]).to.be.a('function');}) );


      it('basic use', (async () => {
        const [fence, reset] = ao_fence_fn();

        const p = fence();
        assert.equal('timeout', await delay_race(p,1));

        reset(1942);
        assert.equal(1942, await delay_race(p,1)); }) );


      it('async iter use', (async () => {
        const [fence, reset] = ao_fence_fn();

        delay().then (() =>reset('ready'));

        for await (let v of fence) {
          assert.equal('ready', v);
          break} }) );


      it('async iter multi use', (async () => {
        const [fence, reset] = ao_fence_fn();

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

        reset('ready');
        assert.equal('pa ready', await delay_race(pa,1));
        assert.equal('pb ready', await delay_race(pb,1));
        assert.equal('ready', await delay_race(pc,1)); }) ); }) );


    describe('ao_fence_obj', (() => {
      it('shape', (() => {
        const res = ao_fence_obj();
        expect(res).to.be.an('object');
        expect(res.fence).to.be.a('function');
        expect(res.reset).to.be.a('function');
        expect(res.ao_fork).to.be.a('function');
        expect(res[Symbol.asyncIterator]).to.be.a('function');}) );


      it('basic use', (async () => {
        const res = ao_fence_obj();

        const p = res.fence();
        assert.equal('timeout', await delay_race(p,1));

        res.reset(1942);
        assert.equal(1942, await delay_race(p,1)); }) );


      it('async iter use', (async () => {
        const res = ao_fence_obj();

        delay().then (() =>res.reset('ready'));

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

        res.reset('ready');
        assert.equal('pa ready', await delay_race(pa,1));
        assert.equal('pb ready', await delay_race(pb,1));
        assert.equal('ready', await delay_race(pc,1)); }) ); }) ); }) );

  describe('ao_pipe base', (() => {
    it('shape', (() => {
      let pipe = is_async_iterable(_ao_pipe_base.create());
      is_gen(pipe.g_in); }) );


    it('example', (async () => {
      let pipe = _ao_pipe_base.create();
      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 2042, 2142]
      , await delay_race(z, 50)); }) );

    it('xfold', (async () => {
      let pipe = _ao_pipe_base.create (() => {
        let s = 0;
        return {xfold: v => s += v} });

      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [1942, 1942+2042, 1942+2042+2142]
      , await delay_race(z, 50)); }) );


    it('xemit', (async () => {
      let pipe = _ao_pipe_base.create({
        xemit: v => ['xe', v]});

      let z = common_ao_pipe_base(pipe,
        [1942, 2042, 2142]);

      assert.deepEqual(
        [['xe', 1942]
          , ['xe', 2042]
          , ['xe', 2142]]
      , await delay_race(z, 50)); }) );


    it('xpull', (async () => {
      let pipe = _ao_pipe_base.create (() => {
        let mem = [];
        return {
          xfold(v) {
            if (undefined !== v) {
              mem.push(v);}
            return mem[0]}
        , xpull() {
            return mem[0]}
        , xemit() {
            let tip = mem.shift();
            let q = mem.slice();
            return {tip, q} } } });

      let z = array_from_ao_iter(pipe);
      for (let v of [1942, 2042, 2142]) {
        pipe.g_in.next(v);}

      await delay(1);
      pipe.g_in.return();

      assert.deepEqual(
        [
          {tip: 1942, q:[2042, 2142]}
        , {tip: 2042, q:[2142]}
        , {tip: 2142, q:[] } ]
      , await z); }) );


    async function common_ao_pipe_base(pipe, values) {
      let z = array_from_ao_iter(pipe);

      await ao_drive(
        delay_walk(values)
      , pipe.g_in);

      pipe.g_in.return();

      return z} }) );

  describe('ao_pipe', function() {
    it('shape', (() => {
      let pipe = is_async_iterable(ao_pipe());
      is_gen(pipe.g_in); }) );


    describe('compute', (() => {
      it('xfold', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10])
        , xfold: v => 1000 + v});

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[1030, 1020, 1010]); }) );


      it('*xgfold', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10])
        , *xgfold() {
            let s = 0;
            while (1) {
              let v = yield s;
              s += v + 1000;} } });

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[1030, 2050, 3060]); }) );


      it('xsrc', (async () => {
        let pipe = ao_pipe({
          xsrc: delay_walk([30,20,10]) });

        let z = array_from_ao_iter(pipe);
        assert.deepEqual(await z,[30,20,10]); }) );


      it('xctx', (async () => {
        let log=[];

        let pipe = ao_pipe({
          *xctx(g_in) {
            log.push('xctx start');
            let tid = setTimeout(
              v => g_in.next(v)
            , 1, 'bingo');

            try {yield;}
            finally {
              clearTimeout(tid);
              log.push('xctx fin'); } } });

        let z = array_from_ao_iter(pipe);

        assert.deepEqual(log,['xctx start']);

        await delay(5);
        pipe.stop();

        assert.deepEqual(log,['xctx start', 'xctx fin']);

        assert.deepEqual(await z,['bingo']); }) ); }) );


    describe('output async generator', (() => {
      it('raw', (async () => {
        let gs = is_gen(
          ao_pipe({
            xsrc: delay_walk([30,20,10])
          , kind: 'raw'}) );

        let v0 = gs.next();
        expect(v0).to.be.a('promise');

        let p = ao_run(gs);
        expect(p).to.be.a('promise');
        expect(await p).to.be.undefined;

        let v1 = gs.next();
        expect(v1).to.be.a('promise');

        expect(await v0).to.deep.equal({value: 30, done: false});
        expect(await v1).to.deep.equal({value: undefined, done: true}); }) );


      it('tap', (async () => {
        let gs = is_async_iterable(
          ao_pipe({
            xsrc: delay_walk([30, 20, 10])
          , kind: 'tap'}) );

        let a = array_from_ao_iter(gs.ao_fork());
        let b = array_from_ao_iter(gs.ao_fork());

        let z = array_from_ao_iter(gs);
        expect(gs.fence).to.be.a('function');

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

        let p = gs.fence();
        expect(p).to.be.a('promise');
        expect(await p).to.equal(30);

        expect(await z).to.deep.equal([30, 20, 10]);
        expect(await a).to.deep.equal([30, 20, 10]);
        expect(await b).to.deep.equal([30, 20, 10]); }) );


      it('split', (async () => {
        let gs = is_async_iterable(
          ao_pipe({
            xsrc: delay_walk([30, 20, 10])
          , kind: 'split'}) );

        let a = array_from_ao_iter(gs);
        let b = array_from_ao_iter(gs.ao_fork());
        let z = array_from_ao_iter(gs);

        expect(gs.fence).to.be.a('function');
        expect(gs.fin).to.be.a('promise');

        expect(a).to.be.a('promise');
        expect(b).to.be.a('promise');
        expect(z).to.be.a('promise');

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

  describe('queue', (() => {
    it('shape', (() => {
      is_fn(ao_queue);

      let aot = is_async_iterable(
        ao_queue());

      is_gen(aot.g_in);}) );

    it('singles', (async () => {
      let aot = ao_queue();

      let p_out1 = aot.next();
      expect(p_out1).to.be.a('promise');

      let p_in1 = aot.g_in.next('first');
      expect(p_in1).to.be.a('promise');

      expect(await p_out1).to.deep.equal({
        value: 'first', done: false}); }) );

    it('vec', (async () => {
      let aot = ao_queue(
        async v => 1000+v);

      let out = array_from_ao_iter(aot);

      let p = ao_drive(
        delay_walk([25, 50, 75, 100])
      , aot.g_in);

      await p;

      await aot.g_in.return();

      expect(await out).to.deep.equal([
        1025, 1050, 1075, 1100]); }) ); }) );

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuanMiLCJzb3VyY2VzIjpbIi4uL3VuaXQvX3V0aWxzLmpzeSIsIi4uLy4uL2VzbS9yb2FwLm1qcyIsIi4uL3VuaXQvc21va2UuanN5IiwiLi4vdW5pdC9jb3JlX2RlZmVycmVkLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvZmVuY2UuanN5IiwiLi4vdW5pdC9waXBlX2Jhc2UuanN5IiwiLi4vdW5pdC9waXBlLmpzeSIsIi4uL3VuaXQvdGltZS5qc3kiLCIuLi91bml0L3F1ZXVlLmpzeSIsIi4uL3VuaXQvZG9tX2FuaW0uanN5IiwiLi4vdW5pdC9kb21fbGlzdGVuLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBhc3NlcnQuZXF1YWwgQCAnZnVuY3Rpb24nLCB0eXBlb2YgZm5cbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IHtcbiAgYXNzaWduOiBfb2JqX2Fzc2lnbixcbiAgZGVmaW5lUHJvcGVydGllczogX29ial9wcm9wcyxcbn0gPSBPYmplY3Q7XG5cbmNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IF9pc19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5jb25zdCBfcmV0X2lkZW50ID0gdiA9PiB2O1xuXG5jb25zdCBfeGludm9rZSA9IHZfZm4gPT5cbiAgX2lzX2ZuKHZfZm4pXG4gICAgPyB2X2ZuKClcbiAgICA6IHZfZm47XG5cbmZ1bmN0aW9uIF94cGlwZV90Z3QocGlwZSkge1xuICBpZiAoX2lzX2ZuKHBpcGUpKSB7XG4gICAgcGlwZSA9IHBpcGUoKTtcbiAgICBwaXBlLm5leHQoKTtcbiAgICByZXR1cm4gcGlwZX1cblxuICByZXR1cm4gcGlwZS5nX2luIHx8IHBpcGV9XG5mdW5jdGlvbiAqIGl0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogX3hpbnZva2UoZ2VuX2luKTt9XG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogX3hpbnZva2UoZ2VuX2luKTt9XG5cblxuZnVuY3Rpb24gZm5fY2hhaW4odGFpbCwgY3R4KSB7XG4gIHJldHVybiBfb2JqX2Fzc2lnbihjaGFpbiwge2NoYWluLCB0YWlsfSlcbiAgZnVuY3Rpb24gY2hhaW4oZm4pIHtcbiAgICBjaGFpbi50YWlsID0gZm4oY2hhaW4udGFpbCwgY3R4KTtcbiAgICByZXR1cm4gY2hhaW59IH1cblxuY29uc3QgYW9fZGVmZXJyZWRfdiA9ICgoKCkgPT4ge1xuICBsZXQgeSxuLF9wc2V0ID0gKGEsYikgPT4geyB5PWEsIG49YjsgfTtcbiAgcmV0dXJuIHAgPT4oXG4gICAgcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuICAsIFtwLCB5LCBuXSkgfSkoKSk7XG5cbmNvbnN0IGFvX2RlZmVycmVkID0gdiA9PihcbiAgdiA9IGFvX2RlZmVycmVkX3YoKVxuLCB7cHJvbWlzZTogdlswXSwgcmVzb2x2ZTogdlsxXSwgcmVqZWN0OiB2WzJdfSk7XG5cbmNvbnN0IGFvX3N5bV9kb25lID0gU3ltYm9sKCdhb19kb25lJyk7XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX3YoKSB7XG4gIGxldCBwPTAsIF9yZXN1bWUgPSAoKT0+e307XG4gIGxldCBfcHNldCA9IGEgPT4gX3Jlc3VtZSA9IGE7XG5cbiAgcmV0dXJuIFtcbiAgICAoKSA9PiAwICE9PSBwID8gcFxuICAgICAgOiBwID0gbmV3IFByb21pc2UoX3BzZXQpXG5cbiAgLCB2ID0+IHtwID0gMDsgX3Jlc3VtZSh2KTt9IF0gfVxuXG5cblxuY29uc3QgX2FvX2ZlbmNlX2FwaSA9e1xuICBzdG9wKCkge3RoaXMuZmVuY2UuZG9uZSA9IHRydWU7fVxuXG4sIGFvX2ZvcmsoKSB7XG4gICAgcmV0dXJuIGFvX2ZlbmNlX2ZvcmsodGhpcy5mZW5jZSl9XG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9IH07XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IF9vYmpfYXNzaWduKHRndCwgX2FvX2ZlbmNlX2FwaSk7XG4gIHJldHVybiBmfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9vYmoodGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfZm4odGd0KTtcbiAgcmV0dXJuIHtfX3Byb3RvX186IF9hb19mZW5jZV9hcGlcbiAgLCBmZW5jZTogdGd0IHx8IGZbMF0sIHJlc2V0OiBmWzFdfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19mZW5jZV9mb3JrKGZlbmNlKSB7XG4gIHdoaWxlICghIGZlbmNlLmRvbmUpIHtcbiAgICBsZXQgdiA9IGF3YWl0IGZlbmNlKCk7XG4gICAgaWYgKGZlbmNlLmRvbmUgfHwgdiA9PT0gYW9fc3ltX2RvbmUpIHtcbiAgICAgIHJldHVybiB2fVxuICAgIHlpZWxkIHY7fSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBfYW9fZmVuY2VfbG9vcChmZW5jZSwgcmVzZXQsIHhmb3JtKSB7XG4gIHRyeSB7XG4gICAgbGV0IHY7XG4gICAgd2hpbGUgKCEgZmVuY2UuZG9uZSkge1xuICAgICAgdiA9IGF3YWl0IGZlbmNlKCk7XG4gICAgICBpZiAodiA9PT0gYW9fc3ltX2RvbmUpIHtcbiAgICAgICAgcmV0dXJufVxuXG4gICAgICB2ID0geWllbGQgdjtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHhmb3JtKSB7XG4gICAgICAgIHYgPSBhd2FpdCB4Zm9ybSh2KTt9XG4gICAgICByZXNldCh2KTsgfSB9XG4gIGZpbmFsbHkge1xuICAgIHJlc2V0KGFvX3N5bV9kb25lKTt9IH1cblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbiwgbm90aWZ5PV9yZXRfaWRlbnQpIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZShnZW5faW4pKSB7XG4gICAgbm90aWZ5KHYpO30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgeGZvcm09X3JldF9pZGVudCkge1xuICBnZW5fdGd0ID0gX3hwaXBlX3RndChnZW5fdGd0KTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZShnZW5faW4pKSB7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0gZ2VuX3RndCkge1xuICAgICAgdiA9IHhmb3JtKHYpO1xuICAgICAgbGV0IHtkb25lfSA9IGF3YWl0IGdlbl90Z3QubmV4dCh2KTtcbiAgICAgIGlmIChkb25lKSB7YnJlYWt9IH0gfSB9XG5cblxuZnVuY3Rpb24gYW9fc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGFvX2l0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jICogW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuXG5mdW5jdGlvbiBzdGVwX2l0ZXIoaXRlcmFibGUsIG11bHRpcGxlKSB7XG4gIGl0ZXJhYmxlID0gaXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgKltTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlfSA9IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG11bHRpcGxlKSB9IH0gfVxuXG5mdW5jdGlvbiBhb19mb3JrKCkge1xuICByZXR1cm4gYW9fZmVuY2VfZm9yayh0aGlzLmZlbmNlKX1cblxuY29uc3QgX2FvX3RhcF9wcm9wcyA9e1xuICBhb19mb3JrOnt2YWx1ZTogYW9fZm9ya31cbiwgY2hhaW46e2dldCgpIHtcbiAgICByZXR1cm4gZm5fY2hhaW4odGhpcywgdGhpcyl9IH0gfTtcblxuZnVuY3Rpb24gYW9fdGFwKGFnX291dCkge1xuICByZXR1cm4gX29ial9wcm9wcyhfYW9fdGFwKGFnX291dCksIF9hb190YXBfcHJvcHMpIH1cblxuZnVuY3Rpb24gX2FvX3RhcChhZ19vdXQpIHtcbiAgbGV0IFtmZW5jZSwgcmVzZXRdID0gYW9fZmVuY2VfdigpO1xuICBsZXQgZ2VuID0gKChhc3luYyBmdW5jdGlvbiAqICgpIHtcbiAgICBmZW5jZS5kb25lID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoYWdfb3V0KSkge1xuICAgICAgICByZXNldCh2KTtcbiAgICAgICAgeWllbGQgdjt9IH1cbiAgICBmaW5hbGx5IHtcbiAgICAgIGZlbmNlLmRvbmUgPSB0cnVlO1xuICAgICAgcmVzZXQoKTt9IH0pLmNhbGwodGhpcykpO1xuXG4gIGdlbi5mZW5jZSA9IGZlbmNlO1xuICByZXR1cm4gZ2VufVxuXG5cblxuY29uc3QgX2FvX3NwbGl0X2FwaSA9e1xuICBnZXQgY2hhaW4oKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfVxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdOiBhb19mb3JrXG4sIGFvX2Zvcmt9O1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IGdlbiA9IF9hb190YXAoYWdfb3V0KTtcbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9hb19zcGxpdF9hcGlcbiAgLCBmaW46IGFvX3J1bihnZW4pXG4gICwgZmVuY2U6IGdlbi5mZW5jZX0gfVxuXG5mdW5jdGlvbiBhb19xdWV1ZSh4Zm9ybSkge1xuICBsZXQgW2ZlbmNlLCBvdXRfcmVzZXRdID0gYW9fZmVuY2VfZm4oKTtcbiAgbGV0IFtpbl9mZW5jZSwgaW5fcmVzZXRdID0gYW9fZmVuY2VfdigpO1xuXG4gIGxldCBhZ19vdXQgPSBfYW9fZmVuY2VfbG9vcChmZW5jZSwgaW5fcmVzZXQpO1xuICBsZXQgZ19pbiA9IF9hb19mZW5jZV9sb29wKGluX2ZlbmNlLCBvdXRfcmVzZXQsIHhmb3JtKTtcblxuICAvLyBhbGxvdyBnX2luIHRvIGluaXRpYWxpemVcbiAgZ19pbi5uZXh0KCkgOyBpbl9yZXNldCgpO1xuICByZXR1cm4gX29ial9hc3NpZ24oYWdfb3V0LCB7ZmVuY2UsIGdfaW59KSB9XG5cbmNvbnN0IF9hc19waXBlX2VuZCA9IChnLG5zKSA9PiBfb2JqX2Fzc2lnbihnLCBucyk7XG5cbi8vfn5+XG4vLyBQaXBlIGJhc2UgYXMgZ2VuZXJhdG9yIGluIGNvbXBvc2VkIG9iamVjdC1mdW5jdGlvbmFsIGltcGxlbWVudGF0aW9uXG5cbmNvbnN0IF9hb19waXBlX2Jhc2UgPXtcbiAgeGZvbGQ6IHYgPT4gdiAvLyBvbiBwdXNoOiBpZGVudGl0eSB0cmFuc2Zvcm1cbiwgeHB1bGwoKSB7fSAvLyBtZW1vcnk6IG5vbmVcbiwgeGVtaXQ6IF94aW52b2tlIC8vIGlkZW50aXR5IHRyYW5zZm9ybSBvciBpbnZva2UgaWYgZnVuY3Rpb25cbiwgeGluaXQoZ19pbiwgYWdfb3V0KSB7fSAvLyBvbiBpbml0OiBkZWZhdWx0IGJlaGF2aW9yXG5cbiwgZ2V0IGNyZWF0ZSgpIHtcbiAgICAvLyBhcyBnZXR0ZXIgdG8gYmluZCBjbGFzcyBhcyBgdGhpc2AgYXQgYWNjZXNzIHRpbWVcbiAgICBjb25zdCBjcmVhdGUgPSAoLi4uIGFyZ3MpID0+XG4gICAgICBfb2JqX2Fzc2lnbih7X19wcm90b19fOiB0aGlzfSxcbiAgICAgICAgLi4uIGFyZ3MubWFwKF94aW52b2tlKSlcbiAgICAgIC5fYW9fcGlwZSgpO1xuXG4gICAgcmV0dXJuIGNyZWF0ZS5jcmVhdGUgPSBjcmVhdGV9XG5cbiwgX2FvX3BpcGUoKSB7XG4gICAgbGV0IGZpbl9sc3QgPSBbXTtcblxuICAgIGxldCBvbl9maW4gPSB0aGlzLm9uX2ZpbiA9XG4gICAgICBnID0+KGZpbl9sc3QucHVzaChnKSwgZyk7XG5cbiAgICBsZXQgc3RvcCA9IHRoaXMuc3RvcCA9ICgoKSA9PiB7XG4gICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuICAgICAgX2Zpbl9waXBlKGZpbl9sc3QpO1xuICAgICAgdGhpcy5fcmVzdW1lKCk7fSk7XG5cblxuICAgIGxldCBnX2luID0gb25fZmluKFxuICAgICAgdGhpcy5fYW9fcGlwZV9pbigpKTtcblxuICAgIGxldCBhZ19vdXQgPSBvbl9maW4oXG4gICAgICB0aGlzLl9hb19waXBlX291dCgpKTtcblxuICAgIC8vIGFkYXB0IGFnX291dCBieSBhcGkgYW5kIGtpbmRcbiAgICBsZXQgc2VsZiA9IHtzdG9wLCBvbl9maW4sIGdfaW59O1xuICAgIGFnX291dCA9IHRoaXMuX2FzX3BpcGVfb3V0KFxuICAgICAgYWdfb3V0LCBzZWxmLCB0aGlzLmtpbmQpO1xuXG4gICAgYWdfb3V0ID0gdGhpcy54aW5pdChnX2luLCBhZ19vdXQpIHx8IGFnX291dDtcblxuICAgIC8vIGFsbG93IGdfaW4gdG8gaW5pdGlhbGl6ZVxuICAgIGdfaW4ubmV4dCgpO1xuICAgIHJldHVybiBhZ19vdXR9XG5cbiwgX2FzX3BpcGVfb3V0OiBfYXNfcGlwZV9lbmRcblxuLCAvL35+flxuICAvLyBVcHN0cmVhbSBpbnB1dCBnZW5lcmF0b3JcbiAgLy8gICBkZXNpZ25lZCBmb3IgbXVsdGlwbGUgZmVlZGVyc1xuXG4gICpfYW9fcGlwZV9pbigpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHY7XG4gICAgICB3aGlsZSAoISB0aGlzLmRvbmUpIHtcbiAgICAgICAgdiA9IHRoaXMueGZvbGQoeWllbGQgdik7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2O1xuICAgICAgICBpZiAoMCAhPT0gdGhpcy5fd2FpdGluZyAmJiB1bmRlZmluZWQgIT09IHYpIHtcbiAgICAgICAgICB0aGlzLl9yZXN1bWUoKTt9IH0gfVxuXG4gICAgZmluYWxseSB7XG4gICAgICB0aGlzLnN0b3AoKTt9IH1cblxuXG4sIC8vfn5+XG4gIC8vIERvd25zdHJlYW0gYXN5bmMgb3V0cHV0IGdlbmVyYXRvclxuICAvLyAgIGRlc2lnbmVkIGZvciBzaW5nbGUgY29uc3VtZXIuXG5cbiAgYXN5bmMgKl9hb19waXBlX291dCgpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHI7XG4gICAgICB3aGlsZSAoISB0aGlzLmRvbmUpIHtcbiAgICAgICAgaWYgKDAgIT09IChyID0gdGhpcy5fd2FpdGluZykpIHtcbiAgICAgICAgICAvLyBwMDogZXhpc3Rpbmcgd2FpdGVyc1xuICAgICAgICAgIHIgPSBhd2FpdCByO1xuICAgICAgICAgIGlmICh0aGlzLmRvbmUpIHticmVha30gfVxuICAgICAgICBlbHNlIGlmICh1bmRlZmluZWQgIT09IChyID0gdGhpcy52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBwMTogYXZhaWxhYmxlIHZhbHVlXG4gICAgICAgICAgdGhpcy52YWx1ZSA9IHVuZGVmaW5lZDt9XG4gICAgICAgIGVsc2UgaWYgKHVuZGVmaW5lZCAhPT0gKHIgPSB0aGlzLnhwdWxsKCkpKSB7XG4gICAgICAgICAgfS8vIHAyOiB4cHVsbCB2YWx1ZSAoZS5nLiBxdWV1ZSBtZW1vcnkpIFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBwMzogYWRkIG5ldyB3YWl0ZXJcbiAgICAgICAgICByID0gYXdhaXQgdGhpcy5fYmluZF93YWl0aW5nKCk7XG4gICAgICAgICAgaWYgKHRoaXMuZG9uZSkge2JyZWFrfSB9XG5cbiAgICAgICAgeWllbGQgdGhpcy54ZW1pdChyKTt9IH1cblxuICAgIGZpbmFsbHkge1xuICAgICAgdGhpcy5zdG9wKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBnZW5lcmF0b3ItbGlrZSB2YWx1ZS9kb25lIHN0YXRlc1xuXG4gIHZhbHVlOiB1bmRlZmluZWRcbiwgZG9uZTogZmFsc2VcblxuLCAvL35+flxuICAvLyBwcm9taXNlLWJhc2VkIGZlbmNlIHRhaWxvcmVkIGZvciBhb19waXBlIHVzZWNhc2VcblxuICBfd2FpdGluZzogMFxuLCBfZnVsZmlsbCgpIHt9XG4sIGFzeW5jIF9yZXN1bWUoKSB7XG4gICAgaWYgKCEgdGhpcy5kb25lKSB7YXdhaXQgdGhpczt9XG5cbiAgICBsZXQge3ZhbHVlLCBfZnVsZmlsbH0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgIT0gdmFsdWUgfHwgdGhpcy5kb25lKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fd2FpdGluZyA9IDA7XG4gICAgICBfZnVsZmlsbCh2YWx1ZSk7fSB9XG5cbiwgX2JpbmRfd2FpdGluZygpIHtcbiAgICBsZXQgX3Jlc2V0ID0geSA9PiB0aGlzLl9mdWxmaWxsID0geTtcbiAgICB0aGlzLl9iaW5kX3dhaXRpbmcgPSAoKSA9PiB0aGlzLl93YWl0aW5nIHx8KFxuICAgICAgdGhpcy5fd2FpdGluZyA9IG5ldyBQcm9taXNlKF9yZXNldCkpO1xuICAgIHJldHVybiB0aGlzLl9iaW5kX3dhaXRpbmcoKX0gfTtcblxuXG5mdW5jdGlvbiBfZmluX3BpcGUoZmluX2xzdCkge1xuICB3aGlsZSAoMCAhPT0gZmluX2xzdC5sZW5ndGgpIHtcbiAgICBsZXQgZyA9IGZpbl9sc3QucG9wKCk7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChfaXNfZm4oZykpIHtnKCk7fVxuICAgICAgZWxzZSBnLnJldHVybigpO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgVHlwZUVycm9yKSB7XG4gICAgICAgIGlmICgnR2VuZXJhdG9yIGlzIGFscmVhZHkgcnVubmluZycgPT09IGVyci5tZXNzYWdlKSB7XG4gICAgICAgICAgY29udGludWV9IH1cbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTt9IH0gfVxuXG5jb25zdCBfYW9fcGlwZV9vdXRfa2luZHMgPXtcbiAgYW9fcmF3OiBnID0+IGdcbiwgYW9fc3BsaXQ6IGFvX3NwbGl0XG4sIGFvX3RhcDogYW9fdGFwfTtcblxuZnVuY3Rpb24gX2FvX3BpcGVfb3V0KGFnX291dCwgc2VsZiwga2luZCkge1xuICBraW5kID0gL15hb18vLnRlc3Qoa2luZCkgPyBraW5kIDogJ2FvXycra2luZDtcbiAgbGV0IGFvX3dyYXAgPSBfYW9fcGlwZV9vdXRfa2luZHNba2luZF07XG4gIGlmICh1bmRlZmluZWQgPT09IGFvX3dyYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vbnduIGFvX3BpcGVfb3V0IGtpbmQgXCIke2tpbmR9XCJgKX1cblxuICByZXR1cm4gX29ial9hc3NpZ24oYW9fd3JhcChhZ19vdXQpLCBzZWxmKSB9XG5cbmNvbnN0IF9hb19waXBlID17XG4gIF9fcHJvdG9fXzogX2FvX3BpcGVfYmFzZVxuXG4sIC8vIHhmb2xkOiB2ID0+IHYgLS0gb24gcHVzaDogaWRlbnRpdHkgdHJhbnNmb3JtXG4gIC8vIHhwdWxsKCkge30gLS0gbWVtb3J5OiBub25lXG4gIC8vIHhlbWl0OiBfeGludm9rZSAtLSBpZGVudGl0eSB0cmFuc2Zvcm0gb3IgaW52b2tlIGlmIGZ1bmN0aW9uXG5cbiAgLy8gKnhnZm9sZCgpIC0tIG9uIHB1c2g6IGdlbmVyYXRvci1iYXNlZCBmb2xkIGltcGxcbiAgLy8gKnhzcmMoKSAtLSBmZWVkIHdpdGggc291cmNlIGdlbmVyYXRvclxuICAvLyAqeGN0eChnZW5fc3JjKSAtLSBvbiBpbml0OiBiaW5kIGV2ZW50IHNvdXJjZXNcblxuICBraW5kOiAnc3BsaXQnXG4sIC8vX2FzX3BpcGVfaW46IF9hb19waXBlX2luXG4gIF9hc19waXBlX291dDogX2FvX3BpcGVfb3V0XG5cbiwgeGluaXQoZ19pbiwgYWdfb3V0KSB7XG4gICAgbGV0IHhnZm9sZCA9IHRoaXMueGdmb2xkO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhnZm9sZCkge1xuICAgICAgdGhpcy5faW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKTt9XG5cbiAgICB0aGlzLl9pbml0X2NoYWluKGdfaW4pO31cblxuXG4sIF9pbml0X3hnZm9sZChnX2luLCB4Z2ZvbGQpIHtcbiAgICBpZiAodW5kZWZpbmVkID09PSB4Z2ZvbGQpIHtcbiAgICAgIHJldHVybn1cblxuICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgeGdmb2xkID0geGdmb2xkLmNhbGwodGhpcywgdGhpcyk7XG5cbiAgICAgIGlmIChfaXNfZm4oeGdmb2xkKSkge1xuICAgICAgICB0aGlzLnhmb2xkID0geGdmb2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZX1cblxuICAgICAgeGdmb2xkLm5leHQoKTt9XG5cbiAgICB0aGlzLnhnZm9sZCA9IHhnZm9sZDtcbiAgICB0aGlzLnhmb2xkID0gdGhpcy5fZm9sZF9nZW47XG4gICAgdGhpcy5vbl9maW4oeGdmb2xkKTtcbiAgICByZXR1cm4gdHJ1ZX1cblxuLCBfZm9sZF9nZW4odikge1xuICAgIGxldCB7ZG9uZSwgdmFsdWV9ID0gdGhpcy54Z2ZvbGQubmV4dCh2KTtcbiAgICBpZiAoZG9uZSkge3RoaXMuZG9uZSA9IHRydWU7fVxuICAgIHJldHVybiB2YWx1ZX1cblxuXG4sIF9pbml0X2NoYWluKGdfaW4pIHtcbiAgICBsZXQge3hzcmMsIHhjdHh9ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4c3JjKSB7XG4gICAgICBhb19kcml2ZSh4c3JjLCBnX2luKVxuICAgICAgICAudGhlbiAoKCkgPT5nX2luLnJldHVybigpKTsgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGN0eCkge1xuICAgICAgdGhpcy5fd2l0aF9jdHgoZ19pbiwgeGN0eCk7fSB9XG5cbiwgX3dpdGhfY3R4KGdfaW4sIHhjdHgpIHtcbiAgICBpZiAoX2lzX2ZuKHhjdHgpKSB7XG4gICAgICB4Y3R4ID0geGN0eChnX2luKTt9XG5cbiAgICBpZiAoeGN0eCAmJiB4Y3R4Lm5leHQpIHtcbiAgICAgIHhjdHgubmV4dChnX2luKTtcbiAgICAgIHRoaXMub25fZmluKHhjdHgpO31cbiAgICByZXR1cm4geGN0eH0gfTtcblxuY29uc3QgYW9fcGlwZSA9IF9hb19waXBlLmNyZWF0ZTtcblxuZnVuY3Rpb24gYW9faW50ZXJ2YWwobXM9MTAwMCkge1xuICBsZXQgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG4gIGxldCB0aWQgPSBzZXRJbnRlcnZhbChfcmVzZXQsIG1zLCAxKTtcbiAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgX2ZlbmNlLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNsZWFySW50ZXJ2YWwodGlkKTtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7fSk7XG4gIHJldHVybiBfZmVuY2V9XG5cblxuZnVuY3Rpb24gYW9fdGltZW91dChtcz0xMDAwKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbih0aW1lb3V0KTtcbiAgcmV0dXJuIHRpbWVvdXRcblxuICBmdW5jdGlvbiB0aW1lb3V0KCkge1xuICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgMSk7XG4gICAgaWYgKHRpZC51bnJlZikge3RpZC51bnJlZigpO31cbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuXG5mdW5jdGlvbiBhb19kZWJvdW5jZShtcz0zMDAsIGdlbl9pbikge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4oKTtcblxuICBfZmVuY2UuZmluID0gKChhc3luYyAoKSA9PiB7XG4gICAgbGV0IHA7XG4gICAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZShnZW5faW4pKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGlkKTtcbiAgICAgIGlmIChfZmVuY2UuZG9uZSkge3JldHVybn1cbiAgICAgIHAgPSBfZmVuY2UoKTtcbiAgICAgIHRpZCA9IHNldFRpbWVvdXQoX3Jlc2V0LCBtcywgdik7fVxuXG4gICAgYXdhaXQgcDtcbiAgICBfZmVuY2UuZG9uZSA9IHRydWU7fSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzZXQpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBfZXZ0X2luaXQgPSBQcm9taXNlLnJlc29sdmUoe3R5cGU6J2luaXQnfSk7XG5mdW5jdGlvbiBhb19kb21fbGlzdGVuKHBpcGUgPSBhb19xdWV1ZSgpKSB7XG4gIGxldCB3aXRoX2RvbSA9IChkb20sIGZuKSA9PlxuICAgIGRvbS5hZGRFdmVudExpc3RlbmVyXG4gICAgICA/IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSlcbiAgICAgIDogX2FvX3dpdGhfZG9tX3ZlYyhfYmluZCwgZm4sIGRvbSk7XG5cbiAgX2JpbmQuc2VsZiA9IHtwaXBlLCB3aXRoX2RvbX07XG4gIHBpcGUud2l0aF9kb20gPSB3aXRoX2RvbTtcbiAgcmV0dXJuIHBpcGVcblxuICBmdW5jdGlvbiBfYmluZChkb20sIGZuX2V2dCwgZm5fZG9tKSB7XG4gICAgcmV0dXJuIGV2dCA9PiB7XG4gICAgICBsZXQgdiA9IGZuX2V2dFxuICAgICAgICA/IGZuX2V2dChldnQsIGRvbSwgZm5fZG9tKVxuICAgICAgICA6IGZuX2RvbShkb20sIGV2dCk7XG5cbiAgICAgIGlmIChudWxsICE9IHYpIHtcbiAgICAgICAgcGlwZS5nX2luLm5leHQodik7fSB9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkge1xuICBsZXQgX29uX2V2dDtcbiAgaWYgKF9pc19mbihmbikpIHtcbiAgICBfZXZ0X2luaXQudGhlbihcbiAgICAgIF9vbl9ldnQgPSBfYmluZChkb20sIHZvaWQgMCwgZm4pKTsgfVxuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGxldCBvcHQsIGV2dF9mbiA9IF9vbl9ldnQ7XG5cbiAgICAgIGxldCBsYXN0ID0gYXJncy5wb3AoKTtcbiAgICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgbGFzdCkge1xuICAgICAgICBldnRfZm4gPSBfYmluZChkb20sIGxhc3QsIF9vbl9ldnQpO1xuICAgICAgICBsYXN0ID0gYXJncy5wb3AoKTt9XG5cbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGxhc3QpIHtcbiAgICAgICAgYXJncy5wdXNoKGxhc3QpO31cbiAgICAgIGVsc2Ugb3B0ID0gbGFzdDtcblxuICAgICAgZm9yIChsZXQgZXZ0IG9mIGFyZ3MpIHtcbiAgICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICAgZXZ0LCBldnRfZm4sIG9wdCk7IH1cblxuICAgICAgcmV0dXJuIHRoaXN9IH0gfVxuXG5cbmZ1bmN0aW9uIF9hb193aXRoX2RvbV92ZWMoX2JpbmQsIGZuLCBlY3R4X2xpc3QpIHtcbiAgZWN0eF9saXN0ID0gQXJyYXkuZnJvbShlY3R4X2xpc3QsXG4gICAgZG9tID0+IF9hb193aXRoX2RvbShfYmluZCwgZm4sIGRvbSkpO1xuXG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYmluZC5zZWxmXG4gICwgbGlzdGVuKC4uLmFyZ3MpIHtcbiAgICAgIGZvciAobGV0IGVjdHggb2YgZWN0eF9saXN0KSB7XG4gICAgICAgIGVjdHgubGlzdGVuKC4uLmFyZ3MpO31cbiAgICAgIHJldHVybiB0aGlzfSB9IH1cblxuZXhwb3J0IHsgX2FvX2ZlbmNlX2xvb3AsIF9hb19waXBlLCBfYW9fcGlwZV9iYXNlLCBfYW9fcGlwZV9vdXQsIF9hb19waXBlX291dF9raW5kcywgX2FvX3RhcCwgX3hpbnZva2UsIF94cGlwZV90Z3QsIGFvX2RlYm91bmNlLCBhb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2xpc3RlbiwgYW9fZHJpdmUsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9mb3JrLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX3YsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19waXBlLCBhb19xdWV1ZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb19zeW1fZG9uZSwgYW9fdGFwLCBhb190aW1lb3V0LCBhb190aW1lcywgZm5fY2hhaW4sIGlzX2FvX2l0ZXIsIGl0ZXIsIHN0ZXBfaXRlciB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cm9hcC5tanMubWFwXG4iLCJpbXBvcnQge2Fzc2VydCwgaXNfZm59IGZyb20gJy4vX3V0aWxzLmpzeSdcblxuaW1wb3J0IHthb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fZmVuY2VfdiwgYW9fZmVuY2VfZm4sIGFvX2ZlbmNlX29ian0gZnJvbSAncm9hcCdcbmltcG9ydCB7aXRlciwgc3RlcF9pdGVyLCBhb19pdGVyLCBhb19zdGVwX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3NwbGl0LCBhb190YXB9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3BpcGV9IGZyb20gJ3JvYXAnXG5cbmRlc2NyaWJlIEAgJ3Ntb2tlJywgQDo6XG4gIGl0IEAgJ2RlZmVycmVkJywgQDo6XG4gICAgaXNfZm4gQCBhb19kZWZlcnJlZFxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRfdlxuXG4gIGl0IEAgJ2ZlbmNlJywgQDo6XG4gICAgaXNfZm4gQCBhb19mZW5jZV92XG4gICAgaXNfZm4gQCBhb19mZW5jZV9mblxuICAgIGlzX2ZuIEAgYW9fZmVuY2Vfb2JqXG5cbiAgaXQgQCAnZHJpdmUnLCBAOjpcbiAgICBpc19mbiBAIGl0ZXJcbiAgICBpc19mbiBAIHN0ZXBfaXRlclxuICAgIGlzX2ZuIEAgYW9faXRlclxuICAgIGlzX2ZuIEAgYW9fc3RlcF9pdGVyXG4gICAgXG4gICAgaXNfZm4gQCBhb19ydW5cbiAgICBpc19mbiBAIGFvX2RyaXZlXG5cbiAgaXQgQCAnc3BsaXQnLCBAOjpcbiAgICBpc19mbiBAIGFvX3NwbGl0XG4gICAgaXNfZm4gQCBhb190YXBcblxuICBpdCBAICdwaXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19waXBlXG5cbiIsImltcG9ydCB7YW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX2RlZmVycmVkJywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWRfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZF92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgzKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzJdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCBbcCwgcmVzb2x2ZSwgcmVqZWN0XSA9IGFvX2RlZmVycmVkX3YoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG5cblxuICBkZXNjcmliZSBAICdhb19kZWZlcnJlZCBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLnByb21pc2UpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlcy5yZXNvbHZlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlamVjdCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWQoKVxuICAgICAgbGV0IHAgPSByZXMucHJvbWlzZVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgICByZXMucmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1biBAIGcsIHYgPT4gbHN0LnB1c2godilcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3QsIHYgPT4gWyd4ZScsIHZdXG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgQFtdICd4ZScsIDE5NDJcbiAgICAgIEBbXSAneGUnLCAyMDQyXG4gICAgICBAW10gJ3hlJywgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdCwgdiA9PiBbJ3hlJywgdl1cblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXVxuICAgICAgQFtdICd4ZScsIDE5NDJcbiAgICAgIEBbXSAneGUnLCAyMDQyXG4gICAgICBAW10gJ3hlJywgMjE0MlxuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdCgpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuIiwiaW1wb3J0IHtpdGVyLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zdGVwX2l0ZXIsIHN0ZXBfaXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19nZW5cbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlIGl0ZXJzJywgQDo6XG5cbiAgaXQgQCAnbm9ybWFsIGl0ZXInLCBAOjpcbiAgICBsZXQgZyA9IGlzX2dlbiBAIGl0ZXIgQCMgMTAsIDIwLCAzMFxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGcubmV4dCgpXG5cblxuICBpdCBAICdhc3luYyBpdGVyJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9faXRlciBAIyAxMCwgMjAsIDMwXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgYXdhaXQgcFxuXG5cbiAgaXQgQCAnbm9ybWFsIHN0ZXBfaXRlcicsIEA6OlxuICAgIGxldCB6ID0gQXJyYXkuZnJvbSBAXG4gICAgICB6aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cbiAgICBmdW5jdGlvbiAqIHppcChhLCBiKSA6OlxuICAgICAgYiA9IHN0ZXBfaXRlcihiKVxuICAgICAgZm9yIGxldCBhdiBvZiBpdGVyKGEpIDo6XG4gICAgICAgIGZvciBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cblxuICBpdCBAICdhc3luYyBhb19zdGVwX2l0ZXInLCBAOjo+XG4gICAgbGV0IHogPSBhd2FpdCBhcnJheV9mcm9tX2FvX2l0ZXIgQFxuICAgICAgYW9femlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG5cbiAgICBhc3luYyBmdW5jdGlvbiAqIGFvX3ppcChhLCBiKSA6OlxuICAgICAgYiA9IGFvX3N0ZXBfaXRlcihiKVxuICAgICAgZm9yIGF3YWl0IGxldCBhdiBvZiBhb19pdGVyKGEpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cbiIsImltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGssXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIHNwbGl0JywgQDo6XG5cbiAgaXQgQCAnYW9fc3BsaXQgdHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fc3BsaXQoZylcblxuICAgICAgZXhwZWN0KGdzLmZpbikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBhID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIwNDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjE0MilcblxuICAgICAgYXdhaXQgZ3MuZmluXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYSA9IGF3YWl0IGEsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYiA9IGF3YWl0IGIsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYyA9IGF3YWl0IGMsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGFzc2VydCBAIGEgIT09IGJcbiAgICAgIGFzc2VydCBAIGEgIT09IGNcbiAgICAgIGFzc2VydCBAIGIgIT09IGNcblxuXG4gIGl0IEAgJ2FvX3RhcCB0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb190YXAoZylcblxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSxcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19mZW5jZScsIEA6OlxuICBkZXNjcmliZSBAICdhb19mZW5jZV92IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDIpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICAgIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzdW1lKDE5NDIpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gICAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuICAgICAgbGV0IGZcblxuICAgICAgcmVzdW1lIEAgJ29uZSdcbiAgICAgIGYgPSBmZW5jZSgpXG4gICAgICByZXN1bWUgQCAndHdvJ1xuICAgICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndHdvJywgYXdhaXQgZlxuXG4gICAgICByZXN1bWUgQCAnZm91cidcbiAgICAgIHJlc3VtZSBAICdmaXZlJ1xuICAgICAgZiA9IGZlbmNlKClcbiAgICAgIHJlc3VtZSBAICdzaXgnXG4gICAgICByZXN1bWUgQCAnc2V2ZW4nXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG5cblxuICAgIGl0IEAgJ25ldmVyIGJsb2NrZWQgb24gZmVuY2UnLCBAOjo+XG4gICAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgICAgcmVzdW1lIEAgJ29uZSdcbiAgICAgIHJlc3VtZSBAICd0d28nXG4gICAgICByZXN1bWUgQCAndGhyZWUnXG5cblxuICAgIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICAgIGxldCB2ID0gJ2EnXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgICBjb25zdCBwID0gQCE+XG4gICAgICAgIHYgPSAnYidcblxuICAgICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdiYicpXG5cbiAgICAgICAgdiA9ICdjJ1xuICAgICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdjYycpXG4gICAgICAgIHYgPSAnZCdcbiAgICAgICAgcmV0dXJuIDE5NDJcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG5cbiAgICAgIDo6XG4gICAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcblxuICAgICAgOjpcbiAgICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdkJylcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX2ZuJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX2ZuKClcblxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDIpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzBdLmFvX2ZvcmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMF1bU3ltYm9sLmFzeW5jSXRlcmF0b3JdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICAgIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzZXRdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzZXQoMTk0MilcbiAgICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG5cbiAgICBpdCBAICdhc3luYyBpdGVyIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzZXRdID0gYW9fZmVuY2VfZm4oKVxuXG4gICAgICBkZWxheSgpLnRoZW4gQD0+IHJlc2V0KCdyZWFkeScpXG5cbiAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiBmZW5jZSA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICAgIGJyZWFrXG5cblxuICAgIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXNldF0gPSBhb19mZW5jZV9mbigpXG5cbiAgICAgIGxldCBwYSA9IEAhPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UgOjpcbiAgICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICAgIGxldCBwYiA9IEAhPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgZmVuY2UuYW9fZm9yaygpIDo6XG4gICAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgICBsZXQgcGMgPSBmZW5jZSgpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBiLDEpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuICAgICAgcmVzZXQoJ3JlYWR5JylcbiAgICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlX29iaicsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlc2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLmFvX2ZvcmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICAgIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc2V0KDE5NDIpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gICAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXNldCgncmVhZHknKVxuXG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgICAgYnJlYWtcblxuXG4gICAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgICBsZXQgcGEgPSBAIT5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgICAgbGV0IHBiID0gQCE+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICAgIHJlcy5yZXNldCgncmVhZHknKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge19hb19waXBlX2Jhc2UsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnYW9fcGlwZSBiYXNlJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHBpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAIF9hb19waXBlX2Jhc2UuY3JlYXRlKClcbiAgICBpc19nZW4gQCBwaXBlLmdfaW5cblxuXG4gIGl0IEAgJ2V4YW1wbGUnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSgpXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICBsZXQgcGlwZSA9IF9hb19waXBlX2Jhc2UuY3JlYXRlIEA6OlxuICAgICAgbGV0IHMgPSAwXG4gICAgICByZXR1cm4gQHt9IHhmb2xkOiB2ID0+IHMgKz0gdlxuXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0JywgQDo6PlxuICAgIGxldCBwaXBlID0gX2FvX3BpcGVfYmFzZS5jcmVhdGUgQDpcbiAgICAgIHhlbWl0OiB2ID0+IFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneHB1bGwnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSBAOjpcbiAgICAgIGxldCBtZW0gPSBbXVxuICAgICAgcmV0dXJuIEB7fVxuICAgICAgICB4Zm9sZCh2KSA6OlxuICAgICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gdiA6OlxuICAgICAgICAgICAgbWVtLnB1c2godilcbiAgICAgICAgICByZXR1cm4gbWVtWzBdXG4gICAgICAgIHhwdWxsKCkgOjpcbiAgICAgICAgICByZXR1cm4gbWVtWzBdXG4gICAgICAgIHhlbWl0KCkgOjpcbiAgICAgICAgICBsZXQgdGlwID0gbWVtLnNoaWZ0KClcbiAgICAgICAgICBsZXQgcSA9IG1lbS5zbGljZSgpXG4gICAgICAgICAgcmV0dXJuIEB7fSB0aXAsIHFcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgZm9yIGxldCB2IG9mIFsxOTQyLCAyMDQyLCAyMTQyXSA6OlxuICAgICAgcGlwZS5nX2luLm5leHQodilcblxuICAgIGF3YWl0IGRlbGF5KDEpXG4gICAgcGlwZS5nX2luLnJldHVybigpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXVxuICAgICAgICBAe30gdGlwOiAxOTQyLCBxOiBAW10gMjA0MiwgMjE0MlxuICAgICAgICBAe30gdGlwOiAyMDQyLCBxOiBAW10gMjE0MlxuICAgICAgICBAe30gdGlwOiAyMTQyLCBxOiBAW11cbiAgICAgIGF3YWl0IHpcblxuXG4gIGFzeW5jIGZ1bmN0aW9uIGNvbW1vbl9hb19waXBlX2Jhc2UocGlwZSwgdmFsdWVzKSA6OlxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHBpcGUuZ19pblxuXG4gICAgcGlwZS5nX2luLnJldHVybigpXG5cbiAgICByZXR1cm4gelxuXG4iLCJpbXBvcnQge2FvX3BpcGUsIGFvX2l0ZXIsIGFvX3J1bn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGssXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdhb19waXBlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBwaXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19waXBlKClcbiAgICBpc19nZW4gQCBwaXBlLmdfaW5cblxuXG4gIGRlc2NyaWJlIEAgJ2NvbXB1dGUnLCBAOjpcbiAgICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgIHhmb2xkOiB2ID0+IDEwMDAgKyB2XG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDEwMzAsIDEwMjAsIDEwMTBcblxuXG4gICAgaXQgQCAnKnhnZm9sZCcsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgICp4Z2ZvbGQoKSA6OlxuICAgICAgICAgIGxldCBzID0gMFxuICAgICAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgICAgIGxldCB2ID0geWllbGQgc1xuICAgICAgICAgICAgcyArPSB2ICsgMTAwMFxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAxMDMwLCAyMDUwLCAzMDYwXG5cblxuICAgIGl0IEAgJ3hzcmMnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAzMCwyMCwxMFxuXG5cbiAgICBpdCBAICd4Y3R4JywgQDo6PlxuICAgICAgbGV0IGxvZz1bXVxuXG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgKnhjdHgoZ19pbikgOjpcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgICAgdHJ5IDo6IHlpZWxkXG4gICAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnXG5cbiAgICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgICBwaXBlLnN0b3AoKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnLCAneGN0eCBmaW4nXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgZGVzY3JpYmUgQCAnb3V0cHV0IGFzeW5jIGdlbmVyYXRvcicsIEA6OlxuICAgIGl0IEAgJ3JhdycsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2dlbiBAXG4gICAgICAgIGFvX3BpcGUgQDpcbiAgICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgICAga2luZDogJ3JhdydcblxuICAgICAgbGV0IHYwID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcCA9IGFvX3J1bihncylcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5iZS51bmRlZmluZWRcblxuICAgICAgbGV0IHYxID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYXdhaXQgdjApLnRvLmRlZXAuZXF1YWwgQDogdmFsdWU6IDMwLCBkb25lOiBmYWxzZVxuICAgICAgZXhwZWN0KGF3YWl0IHYxKS50by5kZWVwLmVxdWFsIEA6IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWVcblxuXG4gICAgaXQgQCAndGFwJywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19waXBlIEA6XG4gICAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwgMjAsIDEwXG4gICAgICAgICAga2luZDogJ3RhcCdcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoeikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHApLnRvLmVxdWFsIEAgMzBcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGEpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGIpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuXG5cbiAgICBpdCBAICdzcGxpdCcsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fcGlwZSBAOlxuICAgICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsIDIwLCAxMFxuICAgICAgICAgIGtpbmQ6ICdzcGxpdCdcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcblxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QoZ3MuZmluKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHopLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5lcXVhbCBAIDMwXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBhKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBiKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fZGVib3VuY2UsIGFvX3RpbWVzLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ3RpbWUnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ludGVydmFsXG4gICAgaXNfZm4gQCBhb190aW1lb3V0XG4gICAgaXNfZm4gQCBhb190aW1lc1xuXG5cbiAgaXQgQCAnYW9faW50ZXJ2YWwnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX2ludGVydmFsKDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb190aW1lb3V0JywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICBhb190aW1lb3V0KDEwKVxuICAgIGxldCBnID0gYW9faXRlcihhb3QpXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQuZXF1YWwoMSwgdmFsdWUpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG5cblxuICBpdCBAICdhb19kZWJvdW5jZScsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgYW9fZGVib3VuY2UoMTAsIFszMCwgMjAsIDEwLCAxNV0pXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIGV4cGVjdChhb3QuZmluKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICBhc3NlcnQuZXF1YWwoMTUsIHZhbHVlKVxuXG4gICAgYXdhaXQgYW90LmZpblxuXG5cbiAgaXQgQCAnYW9fdGltZXMnLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2ludGVydmFsKDEwKVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICBhc3NlcnQodHMxID49IDApXG5cbiAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICBmaW5hbGx5IDo6XG4gICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX3F1ZXVlLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgZGVsYXlfd2FsaywgYXJyYXlfZnJvbV9hb19pdGVyLFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ3F1ZXVlJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19xdWV1ZVxuXG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgIGFvX3F1ZXVlKClcblxuICAgIGlzX2dlbihhb3QuZ19pbilcblxuICBpdCBAICdzaW5nbGVzJywgQDo6PlxuICAgIGxldCBhb3QgPSBhb19xdWV1ZSgpXG5cbiAgICBsZXQgcF9vdXQxID0gYW90Lm5leHQoKVxuICAgIGV4cGVjdChwX291dDEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgbGV0IHBfaW4xID0gYW90LmdfaW4ubmV4dCBAICdmaXJzdCdcbiAgICBleHBlY3QocF9pbjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgZXhwZWN0KGF3YWl0IHBfb3V0MSkudG8uZGVlcC5lcXVhbCBAOlxuICAgICAgdmFsdWU6ICdmaXJzdCcsIGRvbmU6IGZhbHNlXG5cbiAgaXQgQCAndmVjJywgQDo6PlxuICAgIGxldCBhb3QgPSBhb19xdWV1ZSBAXG4gICAgICBhc3luYyB2ID0+IDEwMDArdlxuXG4gICAgbGV0IG91dCA9IGFycmF5X2Zyb21fYW9faXRlcihhb3QpXG5cbiAgICBsZXQgcCA9IGFvX2RyaXZlIEBcbiAgICAgIGRlbGF5X3dhbGsgQCMgMjUsIDUwLCA3NSwgMTAwXG4gICAgICBhb3QuZ19pblxuXG4gICAgYXdhaXQgcFxuXG4gICAgYXdhaXQgYW90LmdfaW4ucmV0dXJuKClcblxuICAgIGV4cGVjdChhd2FpdCBvdXQpLnRvLmRlZXAuZXF1YWwgQCNcbiAgICAgIDEwMjUsIDEwNTAsIDEwNzUsIDExMDBcblxuIiwiaW1wb3J0IHthb19kb21fYW5pbWF0aW9uLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gYW5pbWF0aW9uIGZyYW1lcycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2FuaW1hdGlvblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDo6XG5cbiAgICBpdCBAICdhb19kb21fYW5pbWF0aW9uJywgQDo6PlxuICAgICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2FuaW1hdGlvbigpXG4gICAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh2YWx1ZSA+PSAwKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcblxuICAgIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2RvbV9hbmltYXRpb24oKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG4iLCJpbXBvcnQge2FvX2RvbV9saXN0ZW4sIGFvX3BpcGV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5LFxuICBpc19nZW4sIGlzX2ZuLCBpc19hc3luY19pdGVyYWJsZVxuICBhcnJheV9mcm9tX2FvX2l0ZXJcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gZXZlbnRzJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19kb21fbGlzdGVuXG5cbiAgICBsZXQgZGUgPSBpc19nZW4gQCBhb19kb21fbGlzdGVuKClcbiAgICBpc19nZW4gQCBkZS5nX2luXG4gICAgaXNfZm4gQCBkZS53aXRoX2RvbVxuXG5cbiAgaXQgQCAnc2hhcGUgb2Ygd2l0aF9kb20nLCBAOjpcbiAgICBsZXQgbW9jayA9IEB7fVxuICAgICAgYWRkRXZlbnRMaXN0ZW5lcihldnQsIGZuLCBvcHQpIDo6XG5cbiAgICBsZXQgZV9jdHggPSBhb19kb21fbGlzdGVuKClcbiAgICAgIC53aXRoX2RvbShtb2NrKVxuXG4gICAgaXNfZm4gQCBlX2N0eC53aXRoX2RvbVxuICAgIGlzX2ZuIEAgZV9jdHgubGlzdGVuXG5cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsIDo6XG5cbiAgICBpdCBAICdtZXNzYWdlIGNoYW5uZWxzJywgQDo6PlxuICAgICAgY29uc3Qge3BvcnQxLCBwb3J0Mn0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKVxuXG4gICAgICBjb25zdCBhb190Z3QgPSBhb19kb21fbGlzdGVuKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFvX3RndClcblxuICAgICAgYW9fdGd0XG4gICAgICAgIC53aXRoX2RvbSBAIHBvcnQyLCB2b2lkIHBvcnQyLnN0YXJ0KClcbiAgICAgICAgLmxpc3RlbiBAICdtZXNzYWdlJywgZXZ0ID0+IEA6IHRlc3RfbmFtZTogZXZ0LmRhdGFcblxuICAgICAgOjohPlxuICAgICAgICBmb3IgbGV0IG0gb2YgWydhJywgJ2InLCAnYyddIDo6XG4gICAgICAgICAgcG9ydDEucG9zdE1lc3NhZ2UgQCBgZnJvbSBtc2cgcG9ydDE6ICR7bX1gXG4gICAgICAgICAgYXdhaXQgZGVsYXkoMSlcblxuICAgICAgICBhb190Z3QuZ19pbi5yZXR1cm4oKVxuXG4gICAgICBsZXQgZXhwZWN0ZWQgPSBAW11cbiAgICAgICAgQHt9IHRlc3RfbmFtZTogJ2Zyb20gbXNnIHBvcnQxOiBhJ1xuICAgICAgICBAe30gdGVzdF9uYW1lOiAnZnJvbSBtc2cgcG9ydDE6IGInXG4gICAgICAgIEB7fSB0ZXN0X25hbWU6ICdmcm9tIG1zZyBwb3J0MTogYydcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwoZXhwZWN0ZWQpXG5cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7RUFBQSxtQ0FBbUMsTUFBTTs7O0lBSXZDLFlBQWE7TUFDWCxXQUFZLE9BQVE7OztJQUd0QixjQUFlOzs7SUFHZjtlQUNTO01BQ1A7TUFDQTs7O0lBR0YsYUFBYyxVQUFXO0lBQ3pCOzs7SUFHQTtJQUNBO0lBQ0E7SUFDQTs7O0lBR0EsT0FBUSxpQ0FBa0M7SUFDMUM7OztJQUdBO2VBQ1M7TUFDUDtJQUNGOztFQ2xDRixNQUFNO0VBQ04sRUFBRSxNQUFNLEVBQUUsV0FBVztFQUNyQixFQUFFLGdCQUFnQixFQUFFLFVBQVU7RUFDOUIsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUNYO0VBQ0EsTUFBTSxVQUFVLEdBQUcsQ0FBQztFQUNwQixFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ2xDO0VBQ0EsTUFBTSxNQUFNLEdBQUcsSUFBSTtFQUNuQixFQUFFLFVBQVUsS0FBSyxPQUFPLElBQUk7RUFDNUIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUMxQixNQUFNLFVBQVUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFCO0VBQ0EsTUFBTSxRQUFRLEdBQUcsSUFBSTtFQUNyQixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUM7RUFDZCxNQUFNLElBQUksRUFBRTtFQUNaLE1BQU0sSUFBSSxDQUFDO0FBQ1g7RUFDQSxTQUFTLFVB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
