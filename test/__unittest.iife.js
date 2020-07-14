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

  const {
    isArray: _is_array,
  } = Array;

  const is_ao_iter = g =>
    null != g[Symbol.asyncIterator];

  const _is_fn = v_fn =>
    'function' === typeof v_fn
      && ! is_ao_iter(v_fn);
  const _ret_ident = v => v;

  const _xinvoke$1 = v_fn =>
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
    yield * _xinvoke$1(gen_in);}

  async function * ao_iter(gen_in) {
    yield * _xinvoke$1(gen_in);}


  function fn_chain(tail, ctx) {
    return _obj_assign(chain,{
      chain, tail: _xinvoke$1(tail)} )

    function chain(fn) {
      chain.tail = fn(chain.tail, ctx);
      return chain} }


  function _wm_pipe_closure(wm_absent) {
    let wm = new WeakMap();
    return pipe =>
      _wm_item(wm,
        pipe.g_in || pipe,
        wm_absent) }

  function _wm_item(wm, wm_key, wm_absent) {
    let item = wm.get(wm_key);
    if (undefined === item) {
      item = wm_absent(wm_key);
      wm.set(wm_key, item);}
    return item}

  const ao_deferred_v = ((() => {
    let y,n,_pset = (a,b) => { y=a, n=b; };
    return p =>(
      p = new Promise(_pset)
    , [p, y, n]) })());

  const ao_deferred = v =>(
    v = ao_deferred_v()
  , {promise: v[0], resolve: v[1], reject: v[2]});

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
      if (fence.done) {
        return v}
      yield v;} }


  // export async function * ao_fence_marks(fence, opt) ::
  //   let {signal, trailing, initial} = opt || {}
  //   let f = true === initial
  //     ? fence() : initial
  //
  //   while ! fence.done ::
  //     let v
  //     if trailing ::
  //       v = await f
  //       f = fence()
  //
  //     else ::
  //       f = fence()
  //       v = await f
  //
  //     if fence.done ::
  //       return v
  //
  //     if _is_fn(signal) ::
  //       yield signal(v)
  //     else if signal ::
  //       yield signal
  //     else yield v

  async function ao_run(gen_in, notify=_ret_ident) {
    for await (let v of _xinvoke$1(gen_in)) {
      notify(v);} }


  async function ao_drive(gen_in, gen_tgt, xform=_ret_ident) {
    gen_tgt = _xpipe_tgt(gen_tgt);
    for await (let v of _xinvoke$1(gen_in)) {
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
        for await (let v of _xinvoke$1(ag_out)) {
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

  const _as_pipe_end = (g,ns) => _obj_assign(g, ns);

  //~~~
  // Pipe base as generator in composed object-functional implementation

  const _ao_pipe_base ={
    xfold: v => v // on push: identity transform
  , xpull() {} // memory: none
  , xemit: _xinvoke$1 // identity transform or invoke if function
  , xinit(g_in, ag_out) {} // on init: default behavior

  , get create() {
      // as getter to bind class as `this` at access time
      const create = (... args) =>
        _obj_assign({__proto__: this},
          ... args.map(_xinvoke$1))
        ._ao_pipe();

      return create.create = create}

  , _ao_pipe() {
      let fin_lst = [];
      let self ={
        on_fin: g =>(
          fin_lst.push(g)
        , g)

      , stop: (() => {
          this.done = true;
          _fin_pipe(fin_lst);
          this._resume();}) };

      let {kind} = this;
      let g_in = self.on_fin(this._ao_pipe_in(self.stop));
      let ag_out = self.on_fin(this._ao_pipe_out(self.stop));

      self.g_in = g_in = this._as_pipe_in(g_in, self, kind);
      ag_out = this._as_pipe_out(ag_out, self, kind);

      this.xinit(g_in, ag_out);

      // allow g_in to initialize
      g_in.next();
      return ag_out}

  , _as_pipe_in: _as_pipe_end
  , _as_pipe_out: _as_pipe_end

  , //~~~
    // Upstream input generator
    //   designed for multiple feeders

    *_ao_pipe_in(_finish) {
      try {
        let v;
        while (! this.done) {
          v = this.xfold(yield v);
          this.value = v;
          if (0 !== this._waiting && undefined !== v) {
            this._resume();} } }

      finally {
        _finish();} }


  , //~~~
    // Downstream async output generator
    //   designed for single consumer.

    async *_ao_pipe_out(_finish) {
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
        _finish();} }


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

  const _ao_pipe_in_api ={
    as_pipe_in(self, g_in) {}

  , with_ctx(xctx) {
      if (_is_fn(xctx)) {
        xctx = xctx(this);}

      if (xctx && xctx.next) {
        xctx.next(this);
        this.on_fin(xctx);}
      return xctx}

  , feed(xsrc, xform) {
      return ao_drive(xsrc, this, xform)}

  , bind_vec(... keys) {
      return v => this.next([...keys, v]) }

  , bind_obj(key, ns) {
      return v => this.next({...ns, [key]: v}) } };

  function _ao_pipe_in(g_in, self) {
    return _obj_assign(g_in, _ao_pipe_in_api, self)}

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
  , _as_pipe_in: _ao_pipe_in
  , _as_pipe_out: _ao_pipe_out

  , xinit(g_in) {
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
      g_in.on_fin(xgfold);
      return true}

  , _fold_gen(v) {
      let {done, value} = this.xgfold.next(v);
      if (done) {this.done = true;}
      return value}


  , _init_chain(g_in) {
      let {xsrc, xctx} = this;
      if (undefined !== xsrc) {
        g_in.feed(xsrc)
          .then (() =>g_in.return()); }

      if (undefined !== xctx) {
        g_in.with_ctx(xctx);} } };


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

  const ao_dom_events =
    _wm_pipe_closure(_ao_dom_events_ctx);

  function _ao_dom_events_ctx(g_in) {
    return {__proto__: _dom_events_api
    , wm_elems: new WeakMap()
    , emit: info => g_in.next(info)} }


  const _dom_events_api ={
    // wm_elems: new WeakMap()
    // emit: info => g_in.next(info)

    listen(elem, evt, xfn, evt_opt) {
      let {emit, info} = this;
       {
        let em = _wm_item(this.wm_elems, elem, _elem_map_entry);
        info ={... info, ... em.info, evt};

        let evt0 = evt.split(/[_.]/, 1)[0];
        if ('init' === evt0) {
          evt_fn(elem);
          return this}

        let old_fn = em.get(evt);

        elem.addEventListener(evt0, evt_fn, evt_opt);
        em.set(evt, evt_fn);

        if (undefined !== old_fn) {
          elem.removeEventListener(evt0, old_fn); }

        if ('message' === evt0 && _is_fn(elem.start)) {
          elem.start();} }

      return this

      function evt_fn(e) {
        let v = xfn(e, emit, info);
        if (undefined !== v) {
          emit({... info, v}); } } }


  , remove(elem, ... keys) {
      let {wm_elems} = this;
      let evt_map = wm_elems.get(elem) || new Map();

      let ev_pairs;
      if (0 === keys.length) {
        wm_elems.delete(elem);
        ev_pairs = evt_map.entries();}

      else {
        ev_pairs = keys.map(
          evt0 => [evt0, evt_map.get(evt0)]); }

      for (let [evt0, evt_fn] of ev_pairs) {
        if (undefined !== evt_fn) {
          evt_map.delete(evt0);
          elem.removeEventListener(evt0, evt_fn);} }
      return this}


  , set_info(el, info) {
      let em = _wm_item(this.wm_elems, el, _elem_map_entry);
      _obj_assign(em.info, info);
      return this}

  , with(... ns_args) {
      let {listen, set_info, info} = this;
      set_info = set_info.bind(this);

      for (let ns of ns_args) {
        let ns_this = undefined === ns.info ? this :
          {__proto__: this, info:{... info, ... ns.info}};

        let events =[... _iter_event_list(ns)];
        for (let elem of _iter_named_elems(ns.$, set_info)) {
          for (let evt_args of events) {
            listen.call(ns_this, elem, ... evt_args);} } }

      return this} };


  function _elem_map_entry(elem) {
    let k = elem.name || elem.id
      || (elem.type || elem.tagName || '').toLowerCase()
      || elem[Symbol.toStringTag];

    let m = new Map();
    m.info ={dom_item: k, k};
    return m}


  function * _iter_named_elems(lst, set_info) {
    lst = _is_array(lst) ? lst
      : lst.addEventListener ? [lst]
      : Object.entries(lst);

    for (let ea of lst) {
      if (_is_array(ea)) {
        set_info(ea[1], {k: ea[0]});
        yield ea[1];}

      else yield ea;} }


  function * _iter_event_list(ns) {
    for (let [attr, efn] of Object.entries(ns)) {
      if (! efn || /[^a-z]/.test(attr)) {
        continue}

      attr = attr.replace('_', '.');
      if ('function' === typeof efn) {
        yield [attr, efn, efn.evt_opt];}

      else if (efn.on_evt || efn.evt_opt) {
        yield [attr, efn.on_evt, efn.evt_opt];} } }

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

  describe('core ao_fence', (() => {
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


    describe('ao_fence object', (() => {
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

    describe('ao_split', (() => {
      it('triple', (async () => {
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
        assert(b !== c); }) ); }) );


    describe('ao_tap', (() => {
      it('triple', (async () => {
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
        assert(b !== c); }) ); }) ); }) );

  describe('core _ao_pipe_base', (() => {
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

  describe('core ao_pipe', function() {
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


    describe('g_in: source generator feed', (() => {
      it('with', (async () => {
        let log=[];

        let pipe = ao_pipe();

        pipe.g_in.with_ctx ((function * ( g_in ) {
          log.push('g_in.with start');
          let tid = setTimeout(
            v => g_in.next(v)
          , 1, 'bingo');

          try {yield;}
          finally {
            clearTimeout(tid);
            log.push('g_in.with fin'); } }).bind(this));

        let z = array_from_ao_iter(pipe);

        assert.deepEqual(log,['g_in.with start']);

        await delay(5);
        pipe.stop();

        assert.deepEqual(log,['g_in.with start', 'g_in.with fin']);

        assert.deepEqual(await z,['bingo']); }) );


      it('feed', (async () => {
        let pipe = ao_pipe();
        let z = array_from_ao_iter(pipe);

        await pipe.g_in.feed(
          delay_walk([1942, 2042, 2142]) );

        pipe.stop();
        assert.deepEqual(await z,[1942, 2042, 2142]); }) );


      it('bind_vec', (async () => {
        let pipe = ao_pipe();
        let z = ao_iter(pipe).next();
        let send = pipe.g_in.bind_vec('a', 'b', 'c');
        send('bind_vec');

        z = await z;
        assert.deepEqual(z.value,
          ['a', 'b', 'c', 'bind_vec'] ); }) );


      it('bind_obj', (async () => {
        let pipe = ao_pipe();
        let z = ao_iter(pipe).next();
        let send = pipe.g_in.bind_obj('zed',{
          a: 'aaa', b: 'bbb'} );

        send('bind_obj');
        z = await z;
        assert.deepEqual(z.value,
          {a:'aaa', b:'bbb', zed: 'bind_obj'} ); }) ); }) );


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
      let aot = is_async_iterable(ao_interval(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );

    it('ao_timeout', (async () => {
      let aot = is_async_iterable(ao_timeout(10));
      let g = ao_iter(aot);

      try {
        let p = g.next();
        expect(p).to.be.a('promise');

        let {value} = await p;
        assert.equal(1, value);}

      finally {
        g.return();} }) );

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

  describe('dom events', (() => {
    it('shape', (() => {
      is_fn(ao_dom_events);

      let de = ao_dom_events(ao_pipe());
      is_fn(de.listen);
      is_fn(de.remove);
      is_fn(de.set_info);
      is_fn(de.with); }) );

    if ('undefined' !== typeof MessageChannel) {

      it('message channels', (async () => {
        const {port1, port2} = new MessageChannel();

        const ao_tgt = ao_pipe();
        let z = array_from_ao_iter(ao_tgt);

        ao_dom_events(ao_tgt).with({
          $:{test_name: port2}
        , message: evt => evt.data});

        {(async ()=>{
          for (let m of ['a', 'b', 'c']) {
            port1.postMessage(`from msg port1: ${m}`);
            await delay(1);}

          ao_tgt.g_in.stop();})();}


        let expected =[
          {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: a'}

        , {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: b'}

        , {dom_item: 'MessagePort'
            , evt: 'message'
            , k: 'test_name'
            , v: 'from msg port1: c'} ];

        expect(await z).to.deep.equal(expected);}) ); } }) );

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

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX191bml0dGVzdC5paWZlLmpzIiwic291cmNlcyI6WyJ1bml0L191dGlscy5qc3kiLCIuLi9lc20vcm9hcC5tanMiLCJ1bml0L3Ntb2tlLmpzeSIsInVuaXQvY29yZV9kZWZlcnJlZC5qc3kiLCJ1bml0L2NvcmVfZmVuY2UuanN5IiwidW5pdC9jb3JlX2RyaXZlLmpzeSIsInVuaXQvY29yZV9kcml2ZV9pdGVycy5qc3kiLCJ1bml0L2NvcmVfc3BsaXQuanN5IiwidW5pdC9jb3JlX3BpcGVfYmFzZS5qc3kiLCJ1bml0L2NvcmVfcGlwZS5qc3kiLCJ1bml0L3RpbWUuanN5IiwidW5pdC9kb21fZXZlbnRzLmpzeSIsInVuaXQvZG9tX2FuaW0uanN5Il0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IHsgYXNzZXJ0LCBleHBlY3QgfSA9IHJlcXVpcmUoJ2NoYWknKVxuZXhwb3J0IEB7fSBhc3NlcnQsIGV4cGVjdFxuXG5leHBvcnQgY29uc3QgZGVsYXkgPSAobXM9MSkgPT4gXG4gIG5ldyBQcm9taXNlIEAgeSA9PlxuICAgIHNldFRpbWVvdXQgQCB5LCBtcywgJ3RpbWVvdXQnXG5cbmV4cG9ydCBjb25zdCBkZWxheV9yYWNlID0gKHAsIG1zPTEpID0+IFxuICBQcm9taXNlLnJhY2UgQCMgcCwgZGVsYXkobXMpXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiAqIGRlbGF5X3dhbGsoZ19pbiwgbXM9MSkgOjpcbiAgYXdhaXQgZGVsYXkobXMpXG4gIGZvciBhd2FpdCBsZXQgdiBvZiBnX2luIDo6XG4gICAgeWllbGQgdlxuICAgIGF3YWl0IGRlbGF5KG1zKVxuXG5leHBvcnQgZnVuY3Rpb24gaXNfZm4oZm4pIDo6XG4gIGFzc2VydC5lcXVhbCBAICdmdW5jdGlvbicsIHR5cGVvZiBmblxuICByZXR1cm4gZm5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2dlbihnKSA6OlxuICBpc19mbihnLm5leHQpXG4gIGlzX2ZuKGcucmV0dXJuKVxuICBpc19mbihnLnRocm93KVxuICByZXR1cm4gZ1xuXG5leHBvcnQgZnVuY3Rpb24gaXNfYXN5bmNfaXRlcmFibGUobykgOjpcbiAgYXNzZXJ0IEAgbnVsbCAhPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgJ2FzeW5jIGl0ZXJhYmxlJ1xuICByZXR1cm4gb1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXJyYXlfZnJvbV9hb19pdGVyKGcpIDo6XG4gIGxldCByZXMgPSBbXVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZyA6OlxuICAgIHJlcy5wdXNoKHYpXG4gIHJldHVybiByZXNcblxuIiwiY29uc3Qge1xuICBhc3NpZ246IF9vYmpfYXNzaWduLFxuICBkZWZpbmVQcm9wZXJ0aWVzOiBfb2JqX3Byb3BzLFxufSA9IE9iamVjdDtcblxuY29uc3Qge1xuICBpc0FycmF5OiBfaXNfYXJyYXksXG59ID0gQXJyYXk7XG5cbmNvbnN0IGlzX2FvX2l0ZXIgPSBnID0+XG4gIG51bGwgIT0gZ1tTeW1ib2wuYXN5bmNJdGVyYXRvcl07XG5cbmNvbnN0IF9pc19mbiA9IHZfZm4gPT5cbiAgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHZfZm5cbiAgICAmJiAhIGlzX2FvX2l0ZXIodl9mbik7XG5jb25zdCBfcmV0X2lkZW50ID0gdiA9PiB2O1xuXG5jb25zdCBfeGludm9rZSQxID0gdl9mbiA9PlxuICBfaXNfZm4odl9mbilcbiAgICA/IHZfZm4oKVxuICAgIDogdl9mbjtcblxuZnVuY3Rpb24gX3hwaXBlX3RndChwaXBlKSB7XG4gIGlmIChfaXNfZm4ocGlwZSkpIHtcbiAgICBwaXBlID0gcGlwZSgpO1xuICAgIHBpcGUubmV4dCgpO1xuICAgIHJldHVybiBwaXBlfVxuXG4gIHJldHVybiBwaXBlLmdfaW4gfHwgcGlwZX1cblxuZnVuY3Rpb24gKiBpdGVyKGdlbl9pbikge1xuICB5aWVsZCAqIF94aW52b2tlJDEoZ2VuX2luKTt9XG5cbmFzeW5jIGZ1bmN0aW9uICogYW9faXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBfeGludm9rZSQxKGdlbl9pbik7fVxuXG5cbmZ1bmN0aW9uIGZuX2NoYWluKHRhaWwsIGN0eCkge1xuICByZXR1cm4gX29ial9hc3NpZ24oY2hhaW4se1xuICAgIGNoYWluLCB0YWlsOiBfeGludm9rZSQxKHRhaWwpfSApXG5cbiAgZnVuY3Rpb24gY2hhaW4oZm4pIHtcbiAgICBjaGFpbi50YWlsID0gZm4oY2hhaW4udGFpbCwgY3R4KTtcbiAgICByZXR1cm4gY2hhaW59IH1cblxuXG5mdW5jdGlvbiBfd21fcGlwZV9jbG9zdXJlKHdtX2Fic2VudCkge1xuICBsZXQgd20gPSBuZXcgV2Vha01hcCgpO1xuICByZXR1cm4gcGlwZSA9PlxuICAgIF93bV9pdGVtKHdtLFxuICAgICAgcGlwZS5nX2luIHx8IHBpcGUsXG4gICAgICB3bV9hYnNlbnQpIH1cblxuZnVuY3Rpb24gX3dtX2Nsb3N1cmUod21fYWJzZW50KSB7XG4gIGxldCB3bSA9IG5ldyBXZWFrTWFwKCk7XG4gIHJldHVybiBrZXkgPT5cbiAgICBfd21faXRlbSh3bSxcbiAgICAgIGtleSwgd21fYWJzZW50KSB9XG5cbmZ1bmN0aW9uIF93bV9pdGVtKHdtLCB3bV9rZXksIHdtX2Fic2VudCkge1xuICBsZXQgaXRlbSA9IHdtLmdldCh3bV9rZXkpO1xuICBpZiAodW5kZWZpbmVkID09PSBpdGVtKSB7XG4gICAgaXRlbSA9IHdtX2Fic2VudCh3bV9rZXkpO1xuICAgIHdtLnNldCh3bV9rZXksIGl0ZW0pO31cbiAgcmV0dXJuIGl0ZW19XG5cbmNvbnN0IGFvX2RlZmVycmVkX3YgPSAoKCgpID0+IHtcbiAgbGV0IHksbixfcHNldCA9IChhLGIpID0+IHsgeT1hLCBuPWI7IH07XG4gIHJldHVybiBwID0+KFxuICAgIHAgPSBuZXcgUHJvbWlzZShfcHNldClcbiAgLCBbcCwgeSwgbl0pIH0pKCkpO1xuXG5jb25zdCBhb19kZWZlcnJlZCA9IHYgPT4oXG4gIHYgPSBhb19kZWZlcnJlZF92KClcbiwge3Byb21pc2U6IHZbMF0sIHJlc29sdmU6IHZbMV0sIHJlamVjdDogdlsyXX0pO1xuXG5mdW5jdGlvbiBhb19mZW5jZV92KCkge1xuICBsZXQgcD0wLCBfcmVzdW1lID0gKCk9Pnt9O1xuICBsZXQgX3BzZXQgPSBhID0+IF9yZXN1bWUgPSBhO1xuXG4gIHJldHVybiBbXG4gICAgKCkgPT4gMCAhPT0gcCA/IHBcbiAgICAgIDogcCA9IG5ldyBQcm9taXNlKF9wc2V0KVxuXG4gICwgdiA9PiB7cCA9IDA7IF9yZXN1bWUodik7fSBdIH1cblxuXG5jb25zdCBfYW9fZmVuY2VfYXBpID17XG4gIHN0b3AoKSB7dGhpcy5mZW5jZS5kb25lID0gdHJ1ZTt9XG5cbiwgYW9fZm9yaygpIHtcbiAgICByZXR1cm4gYW9fZmVuY2VfZm9yayh0aGlzLmZlbmNlKX1cblxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmFvX2ZvcmsoKX0gfTtcblxuZnVuY3Rpb24gYW9fZmVuY2VfZm4odGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfdigpO1xuICBpZiAodW5kZWZpbmVkID09PSB0Z3QpIHt0Z3QgPSBmWzBdO31cbiAgdGd0LmZlbmNlID0gX29ial9hc3NpZ24odGd0LCBfYW9fZmVuY2VfYXBpKTtcbiAgcmV0dXJuIGZ9XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX29iaih0Z3QpIHtcbiAgbGV0IGYgPSBhb19mZW5jZV9mbih0Z3QpO1xuICByZXR1cm4ge19fcHJvdG9fXzogX2FvX2ZlbmNlX2FwaVxuICAsIGZlbmNlOiB0Z3QgfHwgZlswXSwgcmVzZXQ6IGZbMV19IH1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2ZlbmNlX2ZvcmsoZmVuY2UpIHtcbiAgd2hpbGUgKCEgZmVuY2UuZG9uZSkge1xuICAgIGxldCB2ID0gYXdhaXQgZmVuY2UoKTtcbiAgICBpZiAoZmVuY2UuZG9uZSkge1xuICAgICAgcmV0dXJuIHZ9XG4gICAgeWllbGQgdjt9IH1cblxuXG4vLyBleHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBhb19mZW5jZV9tYXJrcyhmZW5jZSwgb3B0KSA6OlxuLy8gICBsZXQge3NpZ25hbCwgdHJhaWxpbmcsIGluaXRpYWx9ID0gb3B0IHx8IHt9XG4vLyAgIGxldCBmID0gdHJ1ZSA9PT0gaW5pdGlhbFxuLy8gICAgID8gZmVuY2UoKSA6IGluaXRpYWxcbi8vXG4vLyAgIHdoaWxlICEgZmVuY2UuZG9uZSA6OlxuLy8gICAgIGxldCB2XG4vLyAgICAgaWYgdHJhaWxpbmcgOjpcbi8vICAgICAgIHYgPSBhd2FpdCBmXG4vLyAgICAgICBmID0gZmVuY2UoKVxuLy9cbi8vICAgICBlbHNlIDo6XG4vLyAgICAgICBmID0gZmVuY2UoKVxuLy8gICAgICAgdiA9IGF3YWl0IGZcbi8vXG4vLyAgICAgaWYgZmVuY2UuZG9uZSA6OlxuLy8gICAgICAgcmV0dXJuIHZcbi8vXG4vLyAgICAgaWYgX2lzX2ZuKHNpZ25hbCkgOjpcbi8vICAgICAgIHlpZWxkIHNpZ25hbCh2KVxuLy8gICAgIGVsc2UgaWYgc2lnbmFsIDo6XG4vLyAgICAgICB5aWVsZCBzaWduYWxcbi8vICAgICBlbHNlIHlpZWxkIHZcblxuYXN5bmMgZnVuY3Rpb24gYW9fcnVuKGdlbl9pbiwgbm90aWZ5PV9yZXRfaWRlbnQpIHtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZSQxKGdlbl9pbikpIHtcbiAgICBub3RpZnkodik7fSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gYW9fZHJpdmUoZ2VuX2luLCBnZW5fdGd0LCB4Zm9ybT1fcmV0X2lkZW50KSB7XG4gIGdlbl90Z3QgPSBfeHBpcGVfdGd0KGdlbl90Z3QpO1xuICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoZ2VuX2luKSkge1xuICAgIGlmICh1bmRlZmluZWQgIT09IGdlbl90Z3QpIHtcbiAgICAgIHYgPSB4Zm9ybSh2KTtcbiAgICAgIGxldCB7ZG9uZX0gPSBhd2FpdCBnZW5fdGd0Lm5leHQodik7XG4gICAgICBpZiAoZG9uZSkge2JyZWFrfSB9IH0gfVxuXG5cbmZ1bmN0aW9uIGFvX3N0ZXBfaXRlcihpdGVyYWJsZSwgbXVsdGlwbGUpIHtcbiAgaXRlcmFibGUgPSBhb19pdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyAqIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgaXRlcmFibGUubmV4dCgpO1xuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAobXVsdGlwbGUpIH0gfSB9XG5cblxuZnVuY3Rpb24gc3RlcF9pdGVyKGl0ZXJhYmxlLCBtdWx0aXBsZSkge1xuICBpdGVyYWJsZSA9IGl0ZXIoaXRlcmFibGUpO1xuICByZXR1cm4ge1xuICAgICpbU3ltYm9sLml0ZXJhdG9yXSgpIHtcbiAgICAgIGRvIHtcbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBpdGVyYWJsZS5uZXh0KCk7XG4gICAgICAgIHlpZWxkIHZhbHVlO31cbiAgICAgIHdoaWxlIChtdWx0aXBsZSkgfSB9IH1cblxuZnVuY3Rpb24gYW9fZm9yaygpIHtcbiAgcmV0dXJuIGFvX2ZlbmNlX2ZvcmsodGhpcy5mZW5jZSl9XG5cbmNvbnN0IF9hb190YXBfcHJvcHMgPXtcbiAgYW9fZm9yazp7dmFsdWU6IGFvX2Zvcmt9XG4sIGNoYWluOntnZXQoKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfSB9IH07XG5cbmZ1bmN0aW9uIGFvX3RhcChhZ19vdXQpIHtcbiAgcmV0dXJuIF9vYmpfcHJvcHMoX2FvX3RhcChhZ19vdXQpLCBfYW9fdGFwX3Byb3BzKSB9XG5cbmZ1bmN0aW9uIF9hb190YXAoYWdfb3V0KSB7XG4gIGxldCBbZmVuY2UsIHJlc2V0XSA9IGFvX2ZlbmNlX3YoKTtcbiAgbGV0IGdlbiA9ICgoYXN5bmMgZnVuY3Rpb24gKiAoKSB7XG4gICAgZmVuY2UuZG9uZSA9IGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlJDEoYWdfb3V0KSkge1xuICAgICAgICByZXNldCh2KTtcbiAgICAgICAgeWllbGQgdjt9IH1cbiAgICBmaW5hbGx5IHtcbiAgICAgIGZlbmNlLmRvbmUgPSB0cnVlO1xuICAgICAgcmVzZXQoKTt9IH0pLmNhbGwodGhpcykpO1xuXG4gIGdlbi5mZW5jZSA9IGZlbmNlO1xuICByZXR1cm4gZ2VufVxuXG5cblxuY29uc3QgX2FvX3NwbGl0X2FwaSA9e1xuICBnZXQgY2hhaW4oKSB7XG4gICAgcmV0dXJuIGZuX2NoYWluKHRoaXMsIHRoaXMpfVxuLCBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdOiBhb19mb3JrXG4sIGFvX2Zvcmt9O1xuXG5mdW5jdGlvbiBhb19zcGxpdChhZ19vdXQpIHtcbiAgbGV0IGdlbiA9IF9hb190YXAoYWdfb3V0KTtcbiAgcmV0dXJuIHtcbiAgICBfX3Byb3RvX186IF9hb19zcGxpdF9hcGlcbiAgLCBmaW46IGFvX3J1bihnZW4pXG4gICwgZmVuY2U6IGdlbi5mZW5jZX0gfVxuXG5jb25zdCBfYXNfcGlwZV9lbmQgPSAoZyxucykgPT4gX29ial9hc3NpZ24oZywgbnMpO1xuXG4vL35+flxuLy8gUGlwZSBiYXNlIGFzIGdlbmVyYXRvciBpbiBjb21wb3NlZCBvYmplY3QtZnVuY3Rpb25hbCBpbXBsZW1lbnRhdGlvblxuXG5jb25zdCBfYW9fcGlwZV9iYXNlID17XG4gIHhmb2xkOiB2ID0+IHYgLy8gb24gcHVzaDogaWRlbnRpdHkgdHJhbnNmb3JtXG4sIHhwdWxsKCkge30gLy8gbWVtb3J5OiBub25lXG4sIHhlbWl0OiBfeGludm9rZSQxIC8vIGlkZW50aXR5IHRyYW5zZm9ybSBvciBpbnZva2UgaWYgZnVuY3Rpb25cbiwgeGluaXQoZ19pbiwgYWdfb3V0KSB7fSAvLyBvbiBpbml0OiBkZWZhdWx0IGJlaGF2aW9yXG5cbiwgZ2V0IGNyZWF0ZSgpIHtcbiAgICAvLyBhcyBnZXR0ZXIgdG8gYmluZCBjbGFzcyBhcyBgdGhpc2AgYXQgYWNjZXNzIHRpbWVcbiAgICBjb25zdCBjcmVhdGUgPSAoLi4uIGFyZ3MpID0+XG4gICAgICBfb2JqX2Fzc2lnbih7X19wcm90b19fOiB0aGlzfSxcbiAgICAgICAgLi4uIGFyZ3MubWFwKF94aW52b2tlJDEpKVxuICAgICAgLl9hb19waXBlKCk7XG5cbiAgICByZXR1cm4gY3JlYXRlLmNyZWF0ZSA9IGNyZWF0ZX1cblxuLCBfYW9fcGlwZSgpIHtcbiAgICBsZXQgZmluX2xzdCA9IFtdO1xuICAgIGxldCBzZWxmID17XG4gICAgICBvbl9maW46IGcgPT4oXG4gICAgICAgIGZpbl9sc3QucHVzaChnKVxuICAgICAgLCBnKVxuXG4gICAgLCBzdG9wOiAoKCkgPT4ge1xuICAgICAgICB0aGlzLmRvbmUgPSB0cnVlO1xuICAgICAgICBfZmluX3BpcGUoZmluX2xzdCk7XG4gICAgICAgIHRoaXMuX3Jlc3VtZSgpO30pIH07XG5cbiAgICBsZXQge2tpbmR9ID0gdGhpcztcbiAgICBsZXQgZ19pbiA9IHNlbGYub25fZmluKHRoaXMuX2FvX3BpcGVfaW4oc2VsZi5zdG9wKSk7XG4gICAgbGV0IGFnX291dCA9IHNlbGYub25fZmluKHRoaXMuX2FvX3BpcGVfb3V0KHNlbGYuc3RvcCkpO1xuXG4gICAgc2VsZi5nX2luID0gZ19pbiA9IHRoaXMuX2FzX3BpcGVfaW4oZ19pbiwgc2VsZiwga2luZCk7XG4gICAgYWdfb3V0ID0gdGhpcy5fYXNfcGlwZV9vdXQoYWdfb3V0LCBzZWxmLCBraW5kKTtcblxuICAgIHRoaXMueGluaXQoZ19pbiwgYWdfb3V0KTtcblxuICAgIC8vIGFsbG93IGdfaW4gdG8gaW5pdGlhbGl6ZVxuICAgIGdfaW4ubmV4dCgpO1xuICAgIHJldHVybiBhZ19vdXR9XG5cbiwgX2FzX3BpcGVfaW46IF9hc19waXBlX2VuZFxuLCBfYXNfcGlwZV9vdXQ6IF9hc19waXBlX2VuZFxuXG4sIC8vfn5+XG4gIC8vIFVwc3RyZWFtIGlucHV0IGdlbmVyYXRvclxuICAvLyAgIGRlc2lnbmVkIGZvciBtdWx0aXBsZSBmZWVkZXJzXG5cbiAgKl9hb19waXBlX2luKF9maW5pc2gpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHY7XG4gICAgICB3aGlsZSAoISB0aGlzLmRvbmUpIHtcbiAgICAgICAgdiA9IHRoaXMueGZvbGQoeWllbGQgdik7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2O1xuICAgICAgICBpZiAoMCAhPT0gdGhpcy5fd2FpdGluZyAmJiB1bmRlZmluZWQgIT09IHYpIHtcbiAgICAgICAgICB0aGlzLl9yZXN1bWUoKTt9IH0gfVxuXG4gICAgZmluYWxseSB7XG4gICAgICBfZmluaXNoKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBEb3duc3RyZWFtIGFzeW5jIG91dHB1dCBnZW5lcmF0b3JcbiAgLy8gICBkZXNpZ25lZCBmb3Igc2luZ2xlIGNvbnN1bWVyLlxuXG4gIGFzeW5jICpfYW9fcGlwZV9vdXQoX2ZpbmlzaCkge1xuICAgIHRyeSB7XG4gICAgICBsZXQgcjtcbiAgICAgIHdoaWxlICghIHRoaXMuZG9uZSkge1xuICAgICAgICBpZiAoMCAhPT0gKHIgPSB0aGlzLl93YWl0aW5nKSkge1xuICAgICAgICAgIC8vIHAwOiBleGlzdGluZyB3YWl0ZXJzXG4gICAgICAgICAgciA9IGF3YWl0IHI7XG4gICAgICAgICAgaWYgKHRoaXMuZG9uZSkge2JyZWFrfSB9XG4gICAgICAgIGVsc2UgaWYgKHVuZGVmaW5lZCAhPT0gKHIgPSB0aGlzLnZhbHVlKSkge1xuICAgICAgICAgIC8vIHAxOiBhdmFpbGFibGUgdmFsdWVcbiAgICAgICAgICB0aGlzLnZhbHVlID0gdW5kZWZpbmVkO31cbiAgICAgICAgZWxzZSBpZiAodW5kZWZpbmVkICE9PSAociA9IHRoaXMueHB1bGwoKSkpIHtcbiAgICAgICAgICB9Ly8gcDI6IHhwdWxsIHZhbHVlIChlLmcuIHF1ZXVlIG1lbW9yeSkgXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIHAzOiBhZGQgbmV3IHdhaXRlclxuICAgICAgICAgIHIgPSBhd2FpdCB0aGlzLl9iaW5kX3dhaXRpbmcoKTtcbiAgICAgICAgICBpZiAodGhpcy5kb25lKSB7YnJlYWt9IH1cblxuICAgICAgICB5aWVsZCB0aGlzLnhlbWl0KHIpO30gfVxuXG4gICAgZmluYWxseSB7XG4gICAgICBfZmluaXNoKCk7fSB9XG5cblxuLCAvL35+flxuICAvLyBnZW5lcmF0b3ItbGlrZSB2YWx1ZS9kb25lIHN0YXRlc1xuXG4gIHZhbHVlOiB1bmRlZmluZWRcbiwgZG9uZTogZmFsc2VcblxuLCAvL35+flxuICAvLyBwcm9taXNlLWJhc2VkIGZlbmNlIHRhaWxvcmVkIGZvciBhb19waXBlIHVzZWNhc2VcblxuICBfd2FpdGluZzogMFxuLCBfZnVsZmlsbCgpIHt9XG4sIGFzeW5jIF9yZXN1bWUoKSB7XG4gICAgaWYgKCEgdGhpcy5kb25lKSB7YXdhaXQgdGhpczt9XG5cbiAgICBsZXQge3ZhbHVlLCBfZnVsZmlsbH0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgIT0gdmFsdWUgfHwgdGhpcy5kb25lKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5fd2FpdGluZyA9IDA7XG4gICAgICBfZnVsZmlsbCh2YWx1ZSk7fSB9XG5cbiwgX2JpbmRfd2FpdGluZygpIHtcbiAgICBsZXQgX3Jlc2V0ID0geSA9PiB0aGlzLl9mdWxmaWxsID0geTtcbiAgICB0aGlzLl9iaW5kX3dhaXRpbmcgPSAoKSA9PiB0aGlzLl93YWl0aW5nIHx8KFxuICAgICAgdGhpcy5fd2FpdGluZyA9IG5ldyBQcm9taXNlKF9yZXNldCkpO1xuICAgIHJldHVybiB0aGlzLl9iaW5kX3dhaXRpbmcoKX0gfTtcblxuXG5mdW5jdGlvbiBfZmluX3BpcGUoZmluX2xzdCkge1xuICB3aGlsZSAoMCAhPT0gZmluX2xzdC5sZW5ndGgpIHtcbiAgICBsZXQgZyA9IGZpbl9sc3QucG9wKCk7XG4gICAgdHJ5IHtcbiAgICAgIGlmIChfaXNfZm4oZykpIHtnKCk7fVxuICAgICAgZWxzZSBnLnJldHVybigpO31cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgVHlwZUVycm9yKSB7XG4gICAgICAgIGlmICgnR2VuZXJhdG9yIGlzIGFscmVhZHkgcnVubmluZycgPT09IGVyci5tZXNzYWdlKSB7XG4gICAgICAgICAgY29udGludWV9IH1cbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTt9IH0gfVxuXG5jb25zdCBfYW9fcGlwZV9pbl9hcGkgPXtcbiAgYXNfcGlwZV9pbihzZWxmLCBnX2luKSB7fVxuXG4sIHdpdGhfY3R4KHhjdHgpIHtcbiAgICBpZiAoX2lzX2ZuKHhjdHgpKSB7XG4gICAgICB4Y3R4ID0geGN0eCh0aGlzKTt9XG5cbiAgICBpZiAoeGN0eCAmJiB4Y3R4Lm5leHQpIHtcbiAgICAgIHhjdHgubmV4dCh0aGlzKTtcbiAgICAgIHRoaXMub25fZmluKHhjdHgpO31cbiAgICByZXR1cm4geGN0eH1cblxuLCBmZWVkKHhzcmMsIHhmb3JtKSB7XG4gICAgcmV0dXJuIGFvX2RyaXZlKHhzcmMsIHRoaXMsIHhmb3JtKX1cblxuLCBiaW5kX3ZlYyguLi4ga2V5cykge1xuICAgIHJldHVybiB2ID0+IHRoaXMubmV4dChbLi4ua2V5cywgdl0pIH1cblxuLCBiaW5kX29iaihrZXksIG5zKSB7XG4gICAgcmV0dXJuIHYgPT4gdGhpcy5uZXh0KHsuLi5ucywgW2tleV06IHZ9KSB9IH07XG5cbmZ1bmN0aW9uIF9hb19waXBlX2luKGdfaW4sIHNlbGYpIHtcbiAgcmV0dXJuIF9vYmpfYXNzaWduKGdfaW4sIF9hb19waXBlX2luX2FwaSwgc2VsZil9XG5cbmNvbnN0IF9hb19waXBlX291dF9raW5kcyA9e1xuICBhb19yYXc6IGcgPT4gZ1xuLCBhb19zcGxpdDogYW9fc3BsaXRcbiwgYW9fdGFwOiBhb190YXB9O1xuXG5mdW5jdGlvbiBfYW9fcGlwZV9vdXQoYWdfb3V0LCBzZWxmLCBraW5kKSB7XG4gIGtpbmQgPSAvXmFvXy8udGVzdChraW5kKSA/IGtpbmQgOiAnYW9fJytraW5kO1xuICBsZXQgYW9fd3JhcCA9IF9hb19waXBlX291dF9raW5kc1traW5kXTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gYW9fd3JhcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm9ud24gYW9fcGlwZV9vdXQga2luZCBcIiR7a2luZH1cImApfVxuXG4gIHJldHVybiBfb2JqX2Fzc2lnbihhb193cmFwKGFnX291dCksIHNlbGYpIH1cblxuY29uc3QgX2FvX3BpcGUgPXtcbiAgX19wcm90b19fOiBfYW9fcGlwZV9iYXNlXG5cbiwgLy8geGZvbGQ6IHYgPT4gdiAtLSBvbiBwdXNoOiBpZGVudGl0eSB0cmFuc2Zvcm1cbiAgLy8geHB1bGwoKSB7fSAtLSBtZW1vcnk6IG5vbmVcbiAgLy8geGVtaXQ6IF94aW52b2tlIC0tIGlkZW50aXR5IHRyYW5zZm9ybSBvciBpbnZva2UgaWYgZnVuY3Rpb25cblxuICAvLyAqeGdmb2xkKCkgLS0gb24gcHVzaDogZ2VuZXJhdG9yLWJhc2VkIGZvbGQgaW1wbFxuICAvLyAqeHNyYygpIC0tIGZlZWQgd2l0aCBzb3VyY2UgZ2VuZXJhdG9yXG4gIC8vICp4Y3R4KGdlbl9zcmMpIC0tIG9uIGluaXQ6IGJpbmQgZXZlbnQgc291cmNlc1xuXG4gIGtpbmQ6ICdzcGxpdCdcbiwgX2FzX3BpcGVfaW46IF9hb19waXBlX2luXG4sIF9hc19waXBlX291dDogX2FvX3BpcGVfb3V0XG5cbiwgeGluaXQoZ19pbikge1xuICAgIGxldCB4Z2ZvbGQgPSB0aGlzLnhnZm9sZDtcbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Z2ZvbGQpIHtcbiAgICAgIHRoaXMuX2luaXRfeGdmb2xkKGdfaW4sIHhnZm9sZCk7fVxuXG4gICAgdGhpcy5faW5pdF9jaGFpbihnX2luKTt9XG5cblxuLCBfaW5pdF94Z2ZvbGQoZ19pbiwgeGdmb2xkKSB7XG4gICAgaWYgKHVuZGVmaW5lZCA9PT0geGdmb2xkKSB7XG4gICAgICByZXR1cm59XG5cbiAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgIHhnZm9sZCA9IHhnZm9sZC5jYWxsKHRoaXMsIHRoaXMpO1xuXG4gICAgICBpZiAoX2lzX2ZuKHhnZm9sZCkpIHtcbiAgICAgICAgdGhpcy54Zm9sZCA9IHhnZm9sZDtcbiAgICAgICAgcmV0dXJuIHRydWV9XG5cbiAgICAgIHhnZm9sZC5uZXh0KCk7fVxuXG4gICAgdGhpcy54Z2ZvbGQgPSB4Z2ZvbGQ7XG4gICAgdGhpcy54Zm9sZCA9IHRoaXMuX2ZvbGRfZ2VuO1xuICAgIGdfaW4ub25fZmluKHhnZm9sZCk7XG4gICAgcmV0dXJuIHRydWV9XG5cbiwgX2ZvbGRfZ2VuKHYpIHtcbiAgICBsZXQge2RvbmUsIHZhbHVlfSA9IHRoaXMueGdmb2xkLm5leHQodik7XG4gICAgaWYgKGRvbmUpIHt0aGlzLmRvbmUgPSB0cnVlO31cbiAgICByZXR1cm4gdmFsdWV9XG5cblxuLCBfaW5pdF9jaGFpbihnX2luKSB7XG4gICAgbGV0IHt4c3JjLCB4Y3R4fSA9IHRoaXM7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geHNyYykge1xuICAgICAgZ19pbi5mZWVkKHhzcmMpXG4gICAgICAgIC50aGVuICgoKSA9PmdfaW4ucmV0dXJuKCkpOyB9XG5cbiAgICBpZiAodW5kZWZpbmVkICE9PSB4Y3R4KSB7XG4gICAgICBnX2luLndpdGhfY3R4KHhjdHgpO30gfSB9O1xuXG5cbmNvbnN0IGFvX3BpcGUgPSBfYW9fcGlwZS5jcmVhdGU7XG5cbmZ1bmN0aW9uIGFvX2ludGVydmFsKG1zPTEwMDApIHtcbiAgbGV0IFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbigpO1xuICBsZXQgdGlkID0gc2V0SW50ZXJ2YWwoX3Jlc2V0LCBtcywgMSk7XG4gIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gIF9mZW5jZS5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjbGVhckludGVydmFsKHRpZCk7XG4gICAgX2ZlbmNlLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gX2ZlbmNlfVxuXG5cbmZ1bmN0aW9uIGFvX3RpbWVvdXQobXM9MTAwMCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4odGltZW91dCk7XG4gIHJldHVybiB0aW1lb3V0XG5cbiAgZnVuY3Rpb24gdGltZW91dCgpIHtcbiAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIDEpO1xuICAgIGlmICh0aWQudW5yZWYpIHt0aWQudW5yZWYoKTt9XG4gICAgcmV0dXJuIF9mZW5jZSgpfSB9XG5cblxuZnVuY3Rpb24gYW9fZGVib3VuY2UobXM9MzAwLCBnZW5faW4pIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKCk7XG5cbiAgX2ZlbmNlLmZpbiA9ICgoYXN5bmMgKCkgPT4ge1xuICAgIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UoZ2VuX2luKSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHRpZCk7XG4gICAgICB0aWQgPSBzZXRUaW1lb3V0KF9yZXNldCwgbXMsIHYpO30gfSkoKSk7XG5cbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX3RpbWVzKGdlbl9pbikge1xuICBsZXQgdHMwID0gRGF0ZS5ub3coKTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBnZW5faW4pIHtcbiAgICB5aWVsZCBEYXRlLm5vdygpIC0gdHMwO30gfVxuXG5mdW5jdGlvbiBhb19kb21fYW5pbWF0aW9uKCkge1xuICBsZXQgdGlkLCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4ocmFmKTtcbiAgcmFmLnN0b3AgPSAoKCkgPT4ge1xuICAgIHRpZCA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lKHRpZCk7XG4gICAgcmFmLmRvbmUgPSB0cnVlO30pO1xuICByZXR1cm4gcmFmXG5cbiAgZnVuY3Rpb24gcmFmKCkge1xuICAgIHRpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShfcmVzZXQpO1xuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5jb25zdCBhb19kb21fZXZlbnRzID1cbiAgX3dtX3BpcGVfY2xvc3VyZShfYW9fZG9tX2V2ZW50c19jdHgpO1xuXG5mdW5jdGlvbiBfYW9fZG9tX2V2ZW50c19jdHgoZ19pbikge1xuICByZXR1cm4ge19fcHJvdG9fXzogX2RvbV9ldmVudHNfYXBpXG4gICwgd21fZWxlbXM6IG5ldyBXZWFrTWFwKClcbiAgLCBlbWl0OiBpbmZvID0+IGdfaW4ubmV4dChpbmZvKX0gfVxuXG5cbmNvbnN0IF9kb21fZXZlbnRzX2FwaSA9e1xuICAvLyB3bV9lbGVtczogbmV3IFdlYWtNYXAoKVxuICAvLyBlbWl0OiBpbmZvID0+IGdfaW4ubmV4dChpbmZvKVxuXG4gIGxpc3RlbihlbGVtLCBldnQsIHhmbiwgZXZ0X29wdCkge1xuICAgIGxldCB7ZW1pdCwgaW5mb30gPSB0aGlzO1xuICAgICB7XG4gICAgICBsZXQgZW0gPSBfd21faXRlbSh0aGlzLndtX2VsZW1zLCBlbGVtLCBfZWxlbV9tYXBfZW50cnkpO1xuICAgICAgaW5mbyA9ey4uLiBpbmZvLCAuLi4gZW0uaW5mbywgZXZ0fTtcblxuICAgICAgbGV0IGV2dDAgPSBldnQuc3BsaXQoL1tfLl0vLCAxKVswXTtcbiAgICAgIGlmICgnaW5pdCcgPT09IGV2dDApIHtcbiAgICAgICAgZXZ0X2ZuKGVsZW0pO1xuICAgICAgICByZXR1cm4gdGhpc31cblxuICAgICAgbGV0IG9sZF9mbiA9IGVtLmdldChldnQpO1xuXG4gICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoZXZ0MCwgZXZ0X2ZuLCBldnRfb3B0KTtcbiAgICAgIGVtLnNldChldnQsIGV2dF9mbik7XG5cbiAgICAgIGlmICh1bmRlZmluZWQgIT09IG9sZF9mbikge1xuICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZ0MCwgb2xkX2ZuKTsgfVxuXG4gICAgICBpZiAoJ21lc3NhZ2UnID09PSBldnQwICYmIF9pc19mbihlbGVtLnN0YXJ0KSkge1xuICAgICAgICBlbGVtLnN0YXJ0KCk7fSB9XG5cbiAgICByZXR1cm4gdGhpc1xuXG4gICAgZnVuY3Rpb24gZXZ0X2ZuKGUpIHtcbiAgICAgIGxldCB2ID0geGZuKGUsIGVtaXQsIGluZm8pO1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gdikge1xuICAgICAgICBlbWl0KHsuLi4gaW5mbywgdn0pOyB9IH0gfVxuXG5cbiwgcmVtb3ZlKGVsZW0sIC4uLiBrZXlzKSB7XG4gICAgbGV0IHt3bV9lbGVtc30gPSB0aGlzO1xuICAgIGxldCBldnRfbWFwID0gd21fZWxlbXMuZ2V0KGVsZW0pIHx8IG5ldyBNYXAoKTtcblxuICAgIGxldCBldl9wYWlycztcbiAgICBpZiAoMCA9PT0ga2V5cy5sZW5ndGgpIHtcbiAgICAgIHdtX2VsZW1zLmRlbGV0ZShlbGVtKTtcbiAgICAgIGV2X3BhaXJzID0gZXZ0X21hcC5lbnRyaWVzKCk7fVxuXG4gICAgZWxzZSB7XG4gICAgICBldl9wYWlycyA9IGtleXMubWFwKFxuICAgICAgICBldnQwID0+IFtldnQwLCBldnRfbWFwLmdldChldnQwKV0pOyB9XG5cbiAgICBmb3IgKGxldCBbZXZ0MCwgZXZ0X2ZuXSBvZiBldl9wYWlycykge1xuICAgICAgaWYgKHVuZGVmaW5lZCAhPT0gZXZ0X2ZuKSB7XG4gICAgICAgIGV2dF9tYXAuZGVsZXRlKGV2dDApO1xuICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZ0MCwgZXZ0X2ZuKTt9IH1cbiAgICByZXR1cm4gdGhpc31cblxuXG4sIHNldF9pbmZvKGVsLCBpbmZvKSB7XG4gICAgbGV0IGVtID0gX3dtX2l0ZW0odGhpcy53bV9lbGVtcywgZWwsIF9lbGVtX21hcF9lbnRyeSk7XG4gICAgX29ial9hc3NpZ24oZW0uaW5mbywgaW5mbyk7XG4gICAgcmV0dXJuIHRoaXN9XG5cbiwgd2l0aCguLi4gbnNfYXJncykge1xuICAgIGxldCB7bGlzdGVuLCBzZXRfaW5mbywgaW5mb30gPSB0aGlzO1xuICAgIHNldF9pbmZvID0gc2V0X2luZm8uYmluZCh0aGlzKTtcblxuICAgIGZvciAobGV0IG5zIG9mIG5zX2FyZ3MpIHtcbiAgICAgIGxldCBuc190aGlzID0gdW5kZWZpbmVkID09PSBucy5pbmZvID8gdGhpcyA6XG4gICAgICAgIHtfX3Byb3RvX186IHRoaXMsIGluZm86ey4uLiBpbmZvLCAuLi4gbnMuaW5mb319O1xuXG4gICAgICBsZXQgZXZlbnRzID1bLi4uIF9pdGVyX2V2ZW50X2xpc3QobnMpXTtcbiAgICAgIGZvciAobGV0IGVsZW0gb2YgX2l0ZXJfbmFtZWRfZWxlbXMobnMuJCwgc2V0X2luZm8pKSB7XG4gICAgICAgIGZvciAobGV0IGV2dF9hcmdzIG9mIGV2ZW50cykge1xuICAgICAgICAgIGxpc3Rlbi5jYWxsKG5zX3RoaXMsIGVsZW0sIC4uLiBldnRfYXJncyk7fSB9IH1cblxuICAgIHJldHVybiB0aGlzfSB9O1xuXG5cbmZ1bmN0aW9uIF9lbGVtX21hcF9lbnRyeShlbGVtKSB7XG4gIGxldCBrID0gZWxlbS5uYW1lIHx8IGVsZW0uaWRcbiAgICB8fCAoZWxlbS50eXBlIHx8IGVsZW0udGFnTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKVxuICAgIHx8IGVsZW1bU3ltYm9sLnRvU3RyaW5nVGFnXTtcblxuICBsZXQgbSA9IG5ldyBNYXAoKTtcbiAgbS5pbmZvID17ZG9tX2l0ZW06IGssIGt9O1xuICByZXR1cm4gbX1cblxuXG5mdW5jdGlvbiAqIF9pdGVyX25hbWVkX2VsZW1zKGxzdCwgc2V0X2luZm8pIHtcbiAgbHN0ID0gX2lzX2FycmF5KGxzdCkgPyBsc3RcbiAgICA6IGxzdC5hZGRFdmVudExpc3RlbmVyID8gW2xzdF1cbiAgICA6IE9iamVjdC5lbnRyaWVzKGxzdCk7XG5cbiAgZm9yIChsZXQgZWEgb2YgbHN0KSB7XG4gICAgaWYgKF9pc19hcnJheShlYSkpIHtcbiAgICAgIHNldF9pbmZvKGVhWzFdLCB7azogZWFbMF19KTtcbiAgICAgIHlpZWxkIGVhWzFdO31cblxuICAgIGVsc2UgeWllbGQgZWE7fSB9XG5cblxuZnVuY3Rpb24gKiBfaXRlcl9ldmVudF9saXN0KG5zKSB7XG4gIGZvciAobGV0IFthdHRyLCBlZm5dIG9mIE9iamVjdC5lbnRyaWVzKG5zKSkge1xuICAgIGlmICghIGVmbiB8fCAvW15hLXpdLy50ZXN0KGF0dHIpKSB7XG4gICAgICBjb250aW51ZX1cblxuICAgIGF0dHIgPSBhdHRyLnJlcGxhY2UoJ18nLCAnLicpO1xuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZWZuKSB7XG4gICAgICB5aWVsZCBbYXR0ciwgZWZuLCBlZm4uZXZ0X29wdF07fVxuXG4gICAgZWxzZSBpZiAoZWZuLm9uX2V2dCB8fCBlZm4uZXZ0X29wdCkge1xuICAgICAgeWllbGQgW2F0dHIsIGVmbi5vbl9ldnQsIGVmbi5ldnRfb3B0XTt9IH0gfVxuXG5leHBvcnQgeyBfYW9fZG9tX2V2ZW50c19jdHgsIF9hb19waXBlLCBfYW9fcGlwZV9iYXNlLCBfYW9fcGlwZV9pbiwgX2FvX3BpcGVfaW5fYXBpLCBfYW9fcGlwZV9vdXQsIF9hb19waXBlX291dF9raW5kcywgX2FvX3RhcCwgX2RvbV9ldmVudHNfYXBpLCBfd21fY2xvc3VyZSwgX3dtX2l0ZW0sIF93bV9waXBlX2Nsb3N1cmUsIF94aW52b2tlJDEgYXMgX3hpbnZva2UsIF94cGlwZV90Z3QsIGFvX2RlYm91bmNlLCBhb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdiwgYW9fZG9tX2FuaW1hdGlvbiwgYW9fZG9tX2V2ZW50cywgYW9fZHJpdmUsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9mb3JrLCBhb19mZW5jZV9vYmosIGFvX2ZlbmNlX3YsIGFvX2ludGVydmFsLCBhb19pdGVyLCBhb19waXBlLCBhb19ydW4sIGFvX3NwbGl0LCBhb19zdGVwX2l0ZXIsIGFvX3RhcCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGZuX2NoYWluLCBpc19hb19pdGVyLCBpdGVyLCBzdGVwX2l0ZXIgfTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJvYXAubWpzLm1hcFxuIiwiaW1wb3J0IHthc3NlcnQsIGlzX2ZufSBmcm9tICcuL191dGlscy5qc3knXG5cbmltcG9ydCB7YW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3Z9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX2ZlbmNlX3YsIGFvX2ZlbmNlX2ZuLCBhb19mZW5jZV9vYmp9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2l0ZXIsIHN0ZXBfaXRlciwgYW9faXRlciwgYW9fc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19waXBlfSBmcm9tICdyb2FwJ1xuXG5kZXNjcmliZSBAICdzbW9rZScsIEA6OlxuICBpdCBAICdkZWZlcnJlZCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZGVmZXJyZWRcbiAgICBpc19mbiBAIGFvX2RlZmVycmVkX3ZcblxuICBpdCBAICdmZW5jZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfdlxuICAgIGlzX2ZuIEAgYW9fZmVuY2VfZm5cbiAgICBpc19mbiBAIGFvX2ZlbmNlX29ialxuXG4gIGl0IEAgJ2RyaXZlJywgQDo6XG4gICAgaXNfZm4gQCBpdGVyXG4gICAgaXNfZm4gQCBzdGVwX2l0ZXJcbiAgICBpc19mbiBAIGFvX2l0ZXJcbiAgICBpc19mbiBAIGFvX3N0ZXBfaXRlclxuICAgIFxuICAgIGlzX2ZuIEAgYW9fcnVuXG4gICAgaXNfZm4gQCBhb19kcml2ZVxuXG4gIGl0IEAgJ3NwbGl0JywgQDo6XG4gICAgaXNfZm4gQCBhb19zcGxpdFxuICAgIGlzX2ZuIEAgYW9fdGFwXG5cbiAgaXQgQCAncGlwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fcGlwZVxuXG4iLCJpbXBvcnQge2FvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19kZWZlcnJlZCcsIEA6OlxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVycmVkX3YgdHVwbGUnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZGVmZXJyZWRfdigpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignYXJyYXknKS5vZi5sZW5ndGgoMylcbiAgICAgIGV4cGVjdChyZXNbMF0pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1syXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgaXQgQCAndXNlLCByZXNvbHZlJywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzb2x2ZSgneXVwJylcbiAgICAgIGFzc2VydC5lcXVhbCBAICd5dXAnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgIGl0IEAgJ3VzZSwgcmVqZWN0JywgQDo6PlxuICAgICAgY29uc3QgW3AsIHJlc29sdmUsIHJlamVjdF0gPSBhb19kZWZlcnJlZF92KClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVqZWN0IEAgbmV3IEVycm9yKCdub3BlJylcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0LmZhaWwoKVxuICAgICAgY2F0Y2ggZXJyIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdub3BlJywgZXJyLm1lc3NhZ2VcblxuXG5cbiAgZGVzY3JpYmUgQCAnYW9fZGVmZXJyZWQgb2JqZWN0JywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5wcm9taXNlKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXMucmVzb2x2ZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZWplY3QpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkKClcbiAgICAgIGxldCBwID0gcmVzLnByb21pc2VcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cbiIsImltcG9ydCB7YW9fZmVuY2Vfb2JqLCBhb19mZW5jZV92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19mZW5jZScsIEA6OlxuICBkZXNjcmliZSBAICdhb19mZW5jZV92IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDIpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzWzFdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICAgIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgICBjb25zdCBwID0gZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzdW1lKDE5NDIpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gICAgaXQgQCAnb25seSBmaXJzdCBhZnRlcicsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuICAgICAgbGV0IGZcblxuICAgICAgcmVzdW1lIEAgJ29uZSdcbiAgICAgIGYgPSBmZW5jZSgpXG4gICAgICByZXN1bWUgQCAndHdvJ1xuICAgICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndHdvJywgYXdhaXQgZlxuXG4gICAgICByZXN1bWUgQCAnZm91cidcbiAgICAgIHJlc3VtZSBAICdmaXZlJ1xuICAgICAgZiA9IGZlbmNlKClcbiAgICAgIHJlc3VtZSBAICdzaXgnXG4gICAgICByZXN1bWUgQCAnc2V2ZW4nXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICdzaXgnLCBhd2FpdCBmXG5cblxuICAgIGl0IEAgJ25ldmVyIGJsb2NrZWQgb24gZmVuY2UnLCBAOjo+XG4gICAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgICAgcmVzdW1lIEAgJ29uZSdcbiAgICAgIHJlc3VtZSBAICd0d28nXG4gICAgICByZXN1bWUgQCAndGhyZWUnXG5cblxuICAgIGl0IEAgJ2V4ZXJjaXNlIGZlbmNlJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICAgIGxldCB2ID0gJ2EnXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2EnKVxuXG4gICAgICBjb25zdCBwID0gQCE+XG4gICAgICAgIHYgPSAnYidcblxuICAgICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdiYicpXG5cbiAgICAgICAgdiA9ICdjJ1xuICAgICAgICA6OiBjb25zdCBhbnMgPSBhd2FpdCBmZW5jZSgpXG4gICAgICAgICAgIGV4cGVjdChhbnMpLnRvLmVxdWFsKCdjYycpXG4gICAgICAgIHYgPSAnZCdcbiAgICAgICAgcmV0dXJuIDE5NDJcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG5cbiAgICAgIDo6XG4gICAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYicpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcblxuICAgICAgOjpcbiAgICAgICAgY29uc3QgcCA9IHJlc3VtZSh2K3YpXG4gICAgICAgIGV4cGVjdChwKS50by5iZS51bmRlZmluZWRcblxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdjJylcbiAgICAgIGFzc2VydC5lcXVhbCBAIDE5NDIsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdkJylcblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2ZlbmNlIG9iamVjdCcsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ29iamVjdCcpXG4gICAgICBleHBlY3QocmVzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLnJlc2V0KS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzLmFvX2ZvcmspLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKS50by5iZS5hKCdmdW5jdGlvbicpXG5cblxuICAgIGl0IEAgJ2Jhc2ljIHVzZScsIEA6Oj5cbiAgICAgIGNvbnN0IHJlcyA9IGFvX2ZlbmNlX29iaigpXG5cbiAgICAgIGNvbnN0IHAgPSByZXMuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuICAgICAgcmVzLnJlc2V0KDE5NDIpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcblxuXG4gICAgaXQgQCAnYXN5bmMgaXRlciB1c2UnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgICBkZWxheSgpLnRoZW4gQD0+IHJlcy5yZXNldCgncmVhZHknKVxuXG4gICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzIDo6XG4gICAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIHZcbiAgICAgICAgYnJlYWtcblxuXG4gICAgaXQgQCAnYXN5bmMgaXRlciBtdWx0aSB1c2UnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgICBsZXQgcGEgPSBAIT5cbiAgICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICAgIHJldHVybiBgcGEgJHt2fWBcblxuICAgICAgbGV0IHBiID0gQCE+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMuYW9fZm9yaygpIDo6XG4gICAgICAgICAgcmV0dXJuIGBwYiAke3Z9YFxuXG4gICAgICBsZXQgcGMgPSByZXMuZmVuY2UoKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBjLDEpXG5cbiAgICAgIHJlcy5yZXNldCgncmVhZHknKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3BhIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYSwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3BiIHJlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYiwxKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3JlYWR5JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4iLCJpbXBvcnQge2FvX3J1biwgYW9fZHJpdmV9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBkcml2ZScsIEA6OlxuXG4gIGl0IEAgJ2FvX3J1bicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fcnVuIEAgZywgdiA9PiBsc3QucHVzaCh2KVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgaXQgQCAnYW9fZHJpdmUgZ2VuZXJhdG9yJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnX3RndCA9IGdlbl90ZXN0KGxzdClcbiAgICBnX3RndC5uZXh0KCdmaXJzdCcpXG4gICAgZ190Z3QubmV4dCgnc2Vjb25kJylcbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnX3RndCwgdiA9PiBbJ3hlJywgdl1cblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBnX3RndC5uZXh0KCdmaW5hbCcpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW11cbiAgICAgICdzZWNvbmQnXG4gICAgICBAW10gJ3hlJywgMTk0MlxuICAgICAgQFtdICd4ZScsIDIwNDJcbiAgICAgIEBbXSAneGUnLCAyMTQyXG4gICAgICAnZmluYWwnXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KGxzdCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4gIGl0IEAgJ2FvX2RyaXZlIGZ1bmN0aW9uJywgQDo6PlxuICAgIGxldCBsc3QgPSBbXVxuICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgbGV0IHAgPSBhb19kcml2ZSBAIGcsIGdlbl90ZXN0LCB2ID0+IFsneGUnLCB2XVxuXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoXCJwcm9taXNlXCIpXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHAsIHVuZGVmaW5lZFxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICBAW10gJ3hlJywgMTk0MlxuICAgICAgQFtdICd4ZScsIDIwNDJcbiAgICAgIEBbXSAneGUnLCAyMTQyXG5cbiAgICBmdW5jdGlvbiAqIGdlbl90ZXN0KCkgOjpcbiAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgbGV0IHYgPSB5aWVsZFxuICAgICAgICBsc3QucHVzaCh2KVxuXG4iLCJpbXBvcnQge2l0ZXIsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5pbXBvcnQge2FvX3N0ZXBfaXRlciwgc3RlcF9pdGVyfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2dlblxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUgaXRlcnMnLCBAOjpcblxuICBpdCBAICdub3JtYWwgaXRlcicsIEA6OlxuICAgIGxldCBnID0gaXNfZ2VuIEAgaXRlciBAIyAxMCwgMjAsIDMwXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgZy5uZXh0KClcblxuXG4gIGl0IEAgJ2FzeW5jIGl0ZXInLCBAOjo+XG4gICAgbGV0IGcgPSBpc19nZW4gQCBhb19pdGVyIEAjIDEwLCAyMCwgMzBcblxuICAgIGxldCBwID0gZy5uZXh0KClcbiAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAge3ZhbHVlOiAxMCwgZG9uZTogZmFsc2V9LCBhd2FpdCBwXG5cblxuICBpdCBAICdub3JtYWwgc3RlcF9pdGVyJywgQDo6XG4gICAgbGV0IHogPSBBcnJheS5mcm9tIEBcbiAgICAgIHppcCBAXG4gICAgICAgIFsxMCwgMjAsIDMwXVxuICAgICAgICBbJ2EnLCAnYicsICdjJ11cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LCBAW11cbiAgICAgIFsxMCwgJ2EnXVxuICAgICAgWzIwLCAnYiddXG4gICAgICBbMzAsICdjJ11cblxuICAgIGZ1bmN0aW9uICogemlwKGEsIGIpIDo6XG4gICAgICBiID0gc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgbGV0IGF2IG9mIGl0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuXG4gIGl0IEAgJ2FzeW5jIGFvX3N0ZXBfaXRlcicsIEA6Oj5cbiAgICBsZXQgeiA9IGF3YWl0IGFycmF5X2Zyb21fYW9faXRlciBAXG4gICAgICBhb196aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cblxuICAgIGFzeW5jIGZ1bmN0aW9uICogYW9femlwKGEsIGIpIDo6XG4gICAgICBiID0gYW9fc3RlcF9pdGVyKGIpXG4gICAgICBmb3IgYXdhaXQgbGV0IGF2IG9mIGFvX2l0ZXIoYSkgOjpcbiAgICAgICAgZm9yIGF3YWl0IGxldCBidiBvZiBiIDo6XG4gICAgICAgICAgeWllbGQgW2F2LCBidl1cblxuIiwiaW1wb3J0IHthb19zcGxpdCwgYW9fdGFwfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2FsayxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgc3BsaXQnLCBAOjpcblxuICBkZXNjcmliZSBAICdhb19zcGxpdCcsIEA6OlxuICAgIGl0IEAgJ3RyaXBsZScsIEA6Oj5cbiAgICAgIGxldCBnID0gZGVsYXlfd2FsayBAIyAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3NwbGl0KGcpXG5cbiAgICAgIGV4cGVjdChncy5maW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMTk0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMDQyKVxuXG4gICAgICBwID0gZ3MuZmVuY2UoKVxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDIxNDIpXG5cbiAgICAgIGF3YWl0IGdzLmZpblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGEgPSBhd2FpdCBhLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGIgPSBhd2FpdCBiLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGMgPSBhd2FpdCBjLCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBhc3NlcnQgQCBhICE9PSBiXG4gICAgICBhc3NlcnQgQCBhICE9PSBjXG4gICAgICBhc3NlcnQgQCBiICE9PSBjXG5cblxuICBkZXNjcmliZSBAICdhb190YXAnLCBAOjpcbiAgICBpdCBAICd0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb190YXAoZylcblxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYyA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBleHBlY3QoYykudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG4iLCJpbXBvcnQge19hb19waXBlX2Jhc2UsIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBfYW9fcGlwZV9iYXNlJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHBpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAIF9hb19waXBlX2Jhc2UuY3JlYXRlKClcbiAgICBpc19nZW4gQCBwaXBlLmdfaW5cblxuXG4gIGl0IEAgJ2V4YW1wbGUnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSgpXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICBsZXQgcGlwZSA9IF9hb19waXBlX2Jhc2UuY3JlYXRlIEA6OlxuICAgICAgbGV0IHMgPSAwXG4gICAgICByZXR1cm4gQHt9IHhmb2xkOiB2ID0+IHMgKz0gdlxuXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gMTk0MiwgMTk0MisyMDQyLCAxOTQyKzIwNDIrMjE0MlxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hlbWl0JywgQDo6PlxuICAgIGxldCBwaXBlID0gX2FvX3BpcGVfYmFzZS5jcmVhdGUgQDpcbiAgICAgIHhlbWl0OiB2ID0+IFsneGUnLCB2XVxuXG4gICAgbGV0IHogPSBjb21tb25fYW9fcGlwZV9iYXNlIEAgcGlwZSxcbiAgICAgIFsxOTQyLCAyMDQyLCAyMTQyXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW10gWyd4ZScsIDE5NDJdXG4gICAgICAgICAgWyd4ZScsIDIwNDJdXG4gICAgICAgICAgWyd4ZScsIDIxNDJdXG4gICAgICBhd2FpdCBkZWxheV9yYWNlKHosIDUwKVxuXG5cbiAgaXQgQCAneHB1bGwnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSBAOjpcbiAgICAgIGxldCBtZW0gPSBbXVxuICAgICAgcmV0dXJuIEB7fVxuICAgICAgICB4Zm9sZCh2KSA6OlxuICAgICAgICAgIGlmIHVuZGVmaW5lZCAhPT0gdiA6OlxuICAgICAgICAgICAgbWVtLnB1c2godilcbiAgICAgICAgICByZXR1cm4gbWVtWzBdXG4gICAgICAgIHhwdWxsKCkgOjpcbiAgICAgICAgICByZXR1cm4gbWVtWzBdXG4gICAgICAgIHhlbWl0KCkgOjpcbiAgICAgICAgICBsZXQgdGlwID0gbWVtLnNoaWZ0KClcbiAgICAgICAgICBsZXQgcSA9IG1lbS5zbGljZSgpXG4gICAgICAgICAgcmV0dXJuIEB7fSB0aXAsIHFcblxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgZm9yIGxldCB2IG9mIFsxOTQyLCAyMDQyLCAyMTQyXSA6OlxuICAgICAgcGlwZS5nX2luLm5leHQodilcblxuICAgIGF3YWl0IGRlbGF5KDEpXG4gICAgcGlwZS5nX2luLnJldHVybigpXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEBcbiAgICAgIEBbXVxuICAgICAgICBAe30gdGlwOiAxOTQyLCBxOiBAW10gMjA0MiwgMjE0MlxuICAgICAgICBAe30gdGlwOiAyMDQyLCBxOiBAW10gMjE0MlxuICAgICAgICBAe30gdGlwOiAyMTQyLCBxOiBAW11cbiAgICAgIGF3YWl0IHpcblxuXG4gIGFzeW5jIGZ1bmN0aW9uIGNvbW1vbl9hb19waXBlX2Jhc2UocGlwZSwgdmFsdWVzKSA6OlxuICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG5cbiAgICBhd2FpdCBhb19kcml2ZSBAXG4gICAgICBkZWxheV93YWxrKHZhbHVlcylcbiAgICAgIHBpcGUuZ19pblxuXG4gICAgcGlwZS5nX2luLnJldHVybigpXG5cbiAgICByZXR1cm4gelxuXG4iLCJpbXBvcnQge2FvX3BpcGUsIGFvX2l0ZXIsIGFvX3J1bn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGssXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGFvX3BpcGUnLCBmdW5jdGlvbigpIDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgbGV0IHBpcGUgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3BpcGUoKVxuICAgIGlzX2dlbiBAIHBpcGUuZ19pblxuXG5cbiAgZGVzY3JpYmUgQCAnY29tcHV0ZScsIEA6OlxuICAgIGl0IEAgJ3hmb2xkJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlIEA6XG4gICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgeGZvbGQ6IHYgPT4gMTAwMCArIHZcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMTAzMCwgMTAyMCwgMTAxMFxuXG5cbiAgICBpdCBAICcqeGdmb2xkJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlIEA6XG4gICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgKnhnZm9sZCgpIDo6XG4gICAgICAgICAgbGV0IHMgPSAwXG4gICAgICAgICAgd2hpbGUgMSA6OlxuICAgICAgICAgICAgbGV0IHYgPSB5aWVsZCBzXG4gICAgICAgICAgICBzICs9IHYgKyAxMDAwXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDEwMzAsIDIwNTAsIDMwNjBcblxuXG4gICAgaXQgQCAneHNyYycsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDMwLDIwLDEwXG5cblxuICAgIGl0IEAgJ3hjdHgnLCBAOjo+XG4gICAgICBsZXQgbG9nPVtdXG5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICAqeGN0eChnX2luKSA6OlxuICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggc3RhcnQnXG4gICAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICAgIHYgPT4gZ19pbi5uZXh0KHYpXG4gICAgICAgICAgICAxLCAnYmluZ28nXG5cbiAgICAgICAgICB0cnkgOjogeWllbGRcbiAgICAgICAgICBmaW5hbGx5IDo6XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgICAgbG9nLnB1c2ggQCAneGN0eCBmaW4nXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCdcblxuICAgICAgYXdhaXQgZGVsYXkoNSlcbiAgICAgIHBpcGUuc3RvcCgpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAneGN0eCBzdGFydCcsICd4Y3R4IGZpbidcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICBkZXNjcmliZSBAICdnX2luOiBzb3VyY2UgZ2VuZXJhdG9yIGZlZWQnLCBAOjpcbiAgICBpdCBAICd3aXRoJywgQDo6PlxuICAgICAgbGV0IGxvZz1bXVxuXG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUoKVxuXG4gICAgICBwaXBlLmdfaW4ud2l0aF9jdHggQFxcIGdfaW4gOjoqXG4gICAgICAgIGxvZy5wdXNoIEAgJ2dfaW4ud2l0aCBzdGFydCdcbiAgICAgICAgbGV0IHRpZCA9IHNldFRpbWVvdXQgQCBcbiAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgIDEsICdiaW5nbydcblxuICAgICAgICB0cnkgOjogeWllbGRcbiAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgIGNsZWFyVGltZW91dCh0aWQpXG4gICAgICAgICAgbG9nLnB1c2ggQCAnZ19pbi53aXRoIGZpbidcblxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICdnX2luLndpdGggc3RhcnQnXG5cbiAgICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgICBwaXBlLnN0b3AoKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ2dfaW4ud2l0aCBzdGFydCcsICdnX2luLndpdGggZmluJ1xuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdICdiaW5nbydcblxuXG4gICAgaXQgQCAnZmVlZCcsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSgpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuXG4gICAgICBhd2FpdCBwaXBlLmdfaW4uZmVlZCBAXG4gICAgICAgIGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuXG4gICAgICBwaXBlLnN0b3AoKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cblxuICAgIGl0IEAgJ2JpbmRfdmVjJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlKClcbiAgICAgIGxldCB6ID0gYW9faXRlcihwaXBlKS5uZXh0KClcbiAgICAgIGxldCBzZW5kID0gcGlwZS5nX2luLmJpbmRfdmVjIEAgJ2EnLCAnYicsICdjJ1xuICAgICAgc2VuZCgnYmluZF92ZWMnKVxuXG4gICAgICB6ID0gYXdhaXQgelxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHoudmFsdWUsXG4gICAgICAgIEBbXSAnYScsICdiJywgJ2MnLCAnYmluZF92ZWMnXG5cblxuICAgIGl0IEAgJ2JpbmRfb2JqJywgQDo6PlxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlKClcbiAgICAgIGxldCB6ID0gYW9faXRlcihwaXBlKS5uZXh0KClcbiAgICAgIGxldCBzZW5kID0gcGlwZS5nX2luLmJpbmRfb2JqIEAgJ3plZCcsIEB7fVxuICAgICAgICBhOiAnYWFhJywgYjogJ2JiYidcblxuICAgICAgc2VuZCgnYmluZF9vYmonKVxuICAgICAgeiA9IGF3YWl0IHpcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LnZhbHVlLFxuICAgICAgICBAe30gYTonYWFhJywgYjonYmJiJywgemVkOiAnYmluZF9vYmonXG5cblxuICBkZXNjcmliZSBAICdvdXRwdXQgYXN5bmMgZ2VuZXJhdG9yJywgQDo6XG4gICAgaXQgQCAncmF3JywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfZ2VuIEBcbiAgICAgICAgYW9fcGlwZSBAOlxuICAgICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsMjAsMTBcbiAgICAgICAgICBraW5kOiAncmF3J1xuXG4gICAgICBsZXQgdjAgPSBncy5uZXh0KClcbiAgICAgIGV4cGVjdCh2MCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwID0gYW9fcnVuKGdzKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgICBsZXQgdjEgPSBncy5uZXh0KClcbiAgICAgIGV4cGVjdCh2MSkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGV4cGVjdChhd2FpdCB2MCkudG8uZGVlcC5lcXVhbCBAOiB2YWx1ZTogMzAsIGRvbmU6IGZhbHNlXG4gICAgICBleHBlY3QoYXdhaXQgdjEpLnRvLmRlZXAuZXF1YWwgQDogdmFsdWU6IHVuZGVmaW5lZCwgZG9uZTogdHJ1ZVxuXG5cbiAgICBpdCBAICd0YXAnLCBAOjo+XG4gICAgICBsZXQgZ3MgPSBpc19hc3luY19pdGVyYWJsZSBAXG4gICAgICAgIGFvX3BpcGUgQDpcbiAgICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLCAyMCwgMTBcbiAgICAgICAgICBraW5kOiAndGFwJ1xuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICAgIGV4cGVjdChhKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdCh6KS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHAgPSBncy5mZW5jZSgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYXdhaXQgcCkudG8uZXF1YWwgQCAzMFxuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYSkudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG4gICAgICBleHBlY3QoYXdhaXQgYikudG8uZGVlcC5lcXVhbCBAIyAzMCwgMjAsIDEwXG5cblxuICAgIGl0IEAgJ3NwbGl0JywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19waXBlIEA6XG4gICAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwgMjAsIDEwXG4gICAgICAgICAga2luZDogJ3NwbGl0J1xuXG4gICAgICBsZXQgYSA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGxldCBiID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzKVxuXG4gICAgICBleHBlY3QoZ3MuZmVuY2UpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChncy5maW4pLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoeikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHApLnRvLmVxdWFsIEAgMzBcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGEpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGIpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuXG4iLCJpbXBvcnQge2FvX2ludGVydmFsLCBhb190aW1lb3V0LCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICd0aW1lJywgQDo6XG4gIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgaXNfZm4gQCBhb19pbnRlcnZhbFxuICAgIGlzX2ZuIEAgYW9fdGltZW91dFxuICAgIGlzX2ZuIEAgYW9fdGltZXNcblxuICBpdCBAICdhb19pbnRlcnZhbCcsIEA6Oj5cbiAgICBsZXQgYW90ID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19pbnRlcnZhbCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG4gIGl0IEAgJ2FvX3RpbWVvdXQnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fdGltZW91dCgxMClcbiAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgdHJ5IDo6XG4gICAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0LmVxdWFsKDEsIHZhbHVlKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuXG4gIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19pbnRlcnZhbCgxMClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czF9ID0gYXdhaXQgcFxuICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgIGFzc2VydCh0czIgPj0gdHMxKVxuXG4gICAgZmluYWxseSA6OlxuICAgICAgZy5yZXR1cm4oKVxuIiwiaW1wb3J0IHthb19waXBlLCBhb19kb21fZXZlbnRzfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheSxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbiAgYXJyYXlfZnJvbV9hb19pdGVyXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGV2ZW50cycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2V2ZW50c1xuXG4gICAgbGV0IGRlID0gYW9fZG9tX2V2ZW50cyhhb19waXBlKCkpXG4gICAgaXNfZm4gQCBkZS5saXN0ZW5cbiAgICBpc19mbiBAIGRlLnJlbW92ZVxuICAgIGlzX2ZuIEAgZGUuc2V0X2luZm9cbiAgICBpc19mbiBAIGRlLndpdGhcblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIE1lc3NhZ2VDaGFubmVsIDo6XG5cbiAgICBpdCBAICdtZXNzYWdlIGNoYW5uZWxzJywgQDo6PlxuICAgICAgY29uc3Qge3BvcnQxLCBwb3J0Mn0gPSBuZXcgTWVzc2FnZUNoYW5uZWwoKVxuXG4gICAgICBjb25zdCBhb190Z3QgPSBhb19waXBlKClcbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKGFvX3RndClcblxuICAgICAgYW9fZG9tX2V2ZW50cyhhb190Z3QpLndpdGggQDpcbiAgICAgICAgJDogQHt9IHRlc3RfbmFtZTogcG9ydDJcbiAgICAgICAgbWVzc2FnZTogZXZ0ID0+IGV2dC5kYXRhXG5cbiAgICAgIDo6IT5cbiAgICAgICAgZm9yIGxldCBtIG9mIFsnYScsICdiJywgJ2MnXSA6OlxuICAgICAgICAgIHBvcnQxLnBvc3RNZXNzYWdlIEAgYGZyb20gbXNnIHBvcnQxOiAke219YFxuICAgICAgICAgIGF3YWl0IGRlbGF5KDEpXG5cbiAgICAgICAgYW9fdGd0LmdfaW4uc3RvcCgpXG5cblxuICAgICAgbGV0IGV4cGVjdGVkID0gQFtdXG4gICAgICAgIEB7fSBkb21faXRlbTogJ01lc3NhZ2VQb3J0J1xuICAgICAgICAgICAgZXZ0OiAnbWVzc2FnZSdcbiAgICAgICAgICAgIGs6ICd0ZXN0X25hbWUnXG4gICAgICAgICAgICB2OiAnZnJvbSBtc2cgcG9ydDE6IGEnXG5cbiAgICAgICAgQHt9IGRvbV9pdGVtOiAnTWVzc2FnZVBvcnQnXG4gICAgICAgICAgICBldnQ6ICdtZXNzYWdlJ1xuICAgICAgICAgICAgazogJ3Rlc3RfbmFtZSdcbiAgICAgICAgICAgIHY6ICdmcm9tIG1zZyBwb3J0MTogYidcblxuICAgICAgICBAe30gZG9tX2l0ZW06ICdNZXNzYWdlUG9ydCdcbiAgICAgICAgICAgIGV2dDogJ21lc3NhZ2UnXG4gICAgICAgICAgICBrOiAndGVzdF9uYW1lJ1xuICAgICAgICAgICAgdjogJ2Zyb20gbXNnIHBvcnQxOiBjJ1xuXG4gICAgICBleHBlY3QoYXdhaXQgeikudG8uZGVlcC5lcXVhbChleHBlY3RlZClcblxuIiwiaW1wb3J0IHthb19kb21fYW5pbWF0aW9uLCBhb190aW1lcywgYW9faXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgaXNfZ2VuLCBpc19mbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdkb20gYW5pbWF0aW9uIGZyYW1lcycsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9fZG9tX2FuaW1hdGlvblxuXG4gIGlmICd1bmRlZmluZWQnICE9PSB0eXBlb2YgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIDo6XG5cbiAgICBpdCBAICdhb19kb21fYW5pbWF0aW9uJywgQDo6PlxuICAgICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fZG9tX2FuaW1hdGlvbigpXG4gICAgICBsZXQgZyA9IGFvX2l0ZXIoYW90KVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh2YWx1ZSA+PSAwKVxuXG4gICAgICBmaW5hbGx5IDo6XG4gICAgICAgIGcucmV0dXJuKClcblxuICAgIGl0IEAgJ2FvX3RpbWVzJywgQDo6PlxuICAgICAgbGV0IGcgPSBpc19nZW4gQCBhb190aW1lcyBAIGFvX2RvbV9hbmltYXRpb24oKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgICBleHBlY3QocCkudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgICAgYXNzZXJ0KHRzMSA+PSAwKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMn0gPSBhd2FpdCBnLm5leHQoKVxuICAgICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0VBQUEsbUNBQW1DLE1BQU07OztJQUl2QyxZQUFhO01BQ1gsV0FBWSxPQUFROzs7SUFHdEIsY0FBZTs7O0lBR2Y7ZUFDUztNQUNQO01BQ0E7OztJQUdGLGFBQWMsVUFBVztJQUN6Qjs7O0lBR0E7SUFDQTtJQUNBO0lBQ0E7OztJQUdBLE9BQVEsaUNBQWtDO0lBQzFDOzs7SUFHQTtlQUNTO01BQ1A7SUFDRjs7RUNsQ0YsTUFBTTtFQUNOLEVBQUUsTUFBTSxFQUFFLFdBQVc7RUFDckIsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVO0VBQzlCLENBQUMsR0FBRyxNQUFNLENBQUM7QUFDWDtFQUNBLE1BQU07RUFDTixFQUFFLE9BQU8sRUFBRSxTQUFTO0VBQ3BCLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDVjtFQUNBLE1BQU0sVUFBVSxHQUFHLENBQUM7RUFDcEIsRUFBRSxJQUFJLElBQUksQ0FB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
