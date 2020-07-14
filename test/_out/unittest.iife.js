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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pdHRlc3QuaWlmZS5qcyIsInNvdXJjZXMiOlsiLi4vdW5pdC9fdXRpbHMuanN5IiwiLi4vLi4vZXNtL3JvYXAubWpzIiwiLi4vdW5pdC9zbW9rZS5qc3kiLCIuLi91bml0L2NvcmVfZGVmZXJyZWQuanN5IiwiLi4vdW5pdC9jb3JlX2ZlbmNlLmpzeSIsIi4uL3VuaXQvY29yZV9kcml2ZS5qc3kiLCIuLi91bml0L2NvcmVfZHJpdmVfaXRlcnMuanN5IiwiLi4vdW5pdC9jb3JlX3NwbGl0LmpzeSIsIi4uL3VuaXQvY29yZV9waXBlX2Jhc2UuanN5IiwiLi4vdW5pdC9jb3JlX3BpcGUuanN5IiwiLi4vdW5pdC90aW1lLmpzeSIsIi4uL3VuaXQvZG9tX2V2ZW50cy5qc3kiLCIuLi91bml0L2RvbV9hbmltLmpzeSJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB7IGFzc2VydCwgZXhwZWN0IH0gPSByZXF1aXJlKCdjaGFpJylcbmV4cG9ydCBAe30gYXNzZXJ0LCBleHBlY3RcblxuZXhwb3J0IGNvbnN0IGRlbGF5ID0gKG1zPTEpID0+IFxuICBuZXcgUHJvbWlzZSBAIHkgPT5cbiAgICBzZXRUaW1lb3V0IEAgeSwgbXMsICd0aW1lb3V0J1xuXG5leHBvcnQgY29uc3QgZGVsYXlfcmFjZSA9IChwLCBtcz0xKSA9PiBcbiAgUHJvbWlzZS5yYWNlIEAjIHAsIGRlbGF5KG1zKVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gKiBkZWxheV93YWxrKGdfaW4sIG1zPTEpIDo6XG4gIGF3YWl0IGRlbGF5KG1zKVxuICBmb3IgYXdhaXQgbGV0IHYgb2YgZ19pbiA6OlxuICAgIHlpZWxkIHZcbiAgICBhd2FpdCBkZWxheShtcylcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2ZuKGZuKSA6OlxuICBhc3NlcnQuZXF1YWwgQCAnZnVuY3Rpb24nLCB0eXBlb2YgZm5cbiAgcmV0dXJuIGZuXG5cbmV4cG9ydCBmdW5jdGlvbiBpc19nZW4oZykgOjpcbiAgaXNfZm4oZy5uZXh0KVxuICBpc19mbihnLnJldHVybilcbiAgaXNfZm4oZy50aHJvdylcbiAgcmV0dXJuIGdcblxuZXhwb3J0IGZ1bmN0aW9uIGlzX2FzeW5jX2l0ZXJhYmxlKG8pIDo6XG4gIGFzc2VydCBAIG51bGwgIT0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sICdhc3luYyBpdGVyYWJsZSdcbiAgcmV0dXJuIG9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFycmF5X2Zyb21fYW9faXRlcihnKSA6OlxuICBsZXQgcmVzID0gW11cbiAgZm9yIGF3YWl0IGxldCB2IG9mIGcgOjpcbiAgICByZXMucHVzaCh2KVxuICByZXR1cm4gcmVzXG5cbiIsImNvbnN0IHtcbiAgYXNzaWduOiBfb2JqX2Fzc2lnbixcbiAgZGVmaW5lUHJvcGVydGllczogX29ial9wcm9wcyxcbn0gPSBPYmplY3Q7XG5cbmNvbnN0IHtcbiAgaXNBcnJheTogX2lzX2FycmF5LFxufSA9IEFycmF5O1xuXG5jb25zdCBpc19hb19pdGVyID0gZyA9PlxuICBudWxsICE9IGdbU3ltYm9sLmFzeW5jSXRlcmF0b3JdO1xuXG5jb25zdCBfaXNfZm4gPSB2X2ZuID0+XG4gICdmdW5jdGlvbicgPT09IHR5cGVvZiB2X2ZuXG4gICAgJiYgISBpc19hb19pdGVyKHZfZm4pO1xuY29uc3QgX3JldF9pZGVudCA9IHYgPT4gdjtcblxuY29uc3QgX3hpbnZva2UkMSA9IHZfZm4gPT5cbiAgX2lzX2ZuKHZfZm4pXG4gICAgPyB2X2ZuKClcbiAgICA6IHZfZm47XG5cbmZ1bmN0aW9uIF94cGlwZV90Z3QocGlwZSkge1xuICBpZiAoX2lzX2ZuKHBpcGUpKSB7XG4gICAgcGlwZSA9IHBpcGUoKTtcbiAgICBwaXBlLm5leHQoKTtcbiAgICByZXR1cm4gcGlwZX1cblxuICByZXR1cm4gcGlwZS5nX2luIHx8IHBpcGV9XG5cbmZ1bmN0aW9uICogaXRlcihnZW5faW4pIHtcbiAgeWllbGQgKiBfeGludm9rZSQxKGdlbl9pbik7fVxuXG5hc3luYyBmdW5jdGlvbiAqIGFvX2l0ZXIoZ2VuX2luKSB7XG4gIHlpZWxkICogX3hpbnZva2UkMShnZW5faW4pO31cblxuXG5mdW5jdGlvbiBmbl9jaGFpbih0YWlsLCBjdHgpIHtcbiAgcmV0dXJuIF9vYmpfYXNzaWduKGNoYWluLHtcbiAgICBjaGFpbiwgdGFpbDogX3hpbnZva2UkMSh0YWlsKX0gKVxuXG4gIGZ1bmN0aW9uIGNoYWluKGZuKSB7XG4gICAgY2hhaW4udGFpbCA9IGZuKGNoYWluLnRhaWwsIGN0eCk7XG4gICAgcmV0dXJuIGNoYWlufSB9XG5cblxuZnVuY3Rpb24gX3dtX3BpcGVfY2xvc3VyZSh3bV9hYnNlbnQpIHtcbiAgbGV0IHdtID0gbmV3IFdlYWtNYXAoKTtcbiAgcmV0dXJuIHBpcGUgPT5cbiAgICBfd21faXRlbSh3bSxcbiAgICAgIHBpcGUuZ19pbiB8fCBwaXBlLFxuICAgICAgd21fYWJzZW50KSB9XG5cbmZ1bmN0aW9uIF93bV9jbG9zdXJlKHdtX2Fic2VudCkge1xuICBsZXQgd20gPSBuZXcgV2Vha01hcCgpO1xuICByZXR1cm4ga2V5ID0+XG4gICAgX3dtX2l0ZW0od20sXG4gICAgICBrZXksIHdtX2Fic2VudCkgfVxuXG5mdW5jdGlvbiBfd21faXRlbSh3bSwgd21fa2V5LCB3bV9hYnNlbnQpIHtcbiAgbGV0IGl0ZW0gPSB3bS5nZXQod21fa2V5KTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gaXRlbSkge1xuICAgIGl0ZW0gPSB3bV9hYnNlbnQod21fa2V5KTtcbiAgICB3bS5zZXQod21fa2V5LCBpdGVtKTt9XG4gIHJldHVybiBpdGVtfVxuXG5jb25zdCBhb19kZWZlcnJlZF92ID0gKCgoKSA9PiB7XG4gIGxldCB5LG4sX3BzZXQgPSAoYSxiKSA9PiB7IHk9YSwgbj1iOyB9O1xuICByZXR1cm4gcCA9PihcbiAgICBwID0gbmV3IFByb21pc2UoX3BzZXQpXG4gICwgW3AsIHksIG5dKSB9KSgpKTtcblxuY29uc3QgYW9fZGVmZXJyZWQgPSB2ID0+KFxuICB2ID0gYW9fZGVmZXJyZWRfdigpXG4sIHtwcm9taXNlOiB2WzBdLCByZXNvbHZlOiB2WzFdLCByZWplY3Q6IHZbMl19KTtcblxuZnVuY3Rpb24gYW9fZmVuY2VfdigpIHtcbiAgbGV0IHA9MCwgX3Jlc3VtZSA9ICgpPT57fTtcbiAgbGV0IF9wc2V0ID0gYSA9PiBfcmVzdW1lID0gYTtcblxuICByZXR1cm4gW1xuICAgICgpID0+IDAgIT09IHAgPyBwXG4gICAgICA6IHAgPSBuZXcgUHJvbWlzZShfcHNldClcblxuICAsIHYgPT4ge3AgPSAwOyBfcmVzdW1lKHYpO30gXSB9XG5cblxuY29uc3QgX2FvX2ZlbmNlX2FwaSA9e1xuICBzdG9wKCkge3RoaXMuZmVuY2UuZG9uZSA9IHRydWU7fVxuXG4sIGFvX2ZvcmsoKSB7XG4gICAgcmV0dXJuIGFvX2ZlbmNlX2ZvcmsodGhpcy5mZW5jZSl9XG5cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpIHtcbiAgICByZXR1cm4gdGhpcy5hb19mb3JrKCl9IH07XG5cbmZ1bmN0aW9uIGFvX2ZlbmNlX2ZuKHRndCkge1xuICBsZXQgZiA9IGFvX2ZlbmNlX3YoKTtcbiAgaWYgKHVuZGVmaW5lZCA9PT0gdGd0KSB7dGd0ID0gZlswXTt9XG4gIHRndC5mZW5jZSA9IF9vYmpfYXNzaWduKHRndCwgX2FvX2ZlbmNlX2FwaSk7XG4gIHJldHVybiBmfVxuXG5mdW5jdGlvbiBhb19mZW5jZV9vYmoodGd0KSB7XG4gIGxldCBmID0gYW9fZmVuY2VfZm4odGd0KTtcbiAgcmV0dXJuIHtfX3Byb3RvX186IF9hb19mZW5jZV9hcGlcbiAgLCBmZW5jZTogdGd0IHx8IGZbMF0sIHJlc2V0OiBmWzFdfSB9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb19mZW5jZV9mb3JrKGZlbmNlKSB7XG4gIHdoaWxlICghIGZlbmNlLmRvbmUpIHtcbiAgICBsZXQgdiA9IGF3YWl0IGZlbmNlKCk7XG4gICAgaWYgKGZlbmNlLmRvbmUpIHtcbiAgICAgIHJldHVybiB2fVxuICAgIHlpZWxkIHY7fSB9XG5cblxuLy8gZXhwb3J0IGFzeW5jIGZ1bmN0aW9uICogYW9fZmVuY2VfbWFya3MoZmVuY2UsIG9wdCkgOjpcbi8vICAgbGV0IHtzaWduYWwsIHRyYWlsaW5nLCBpbml0aWFsfSA9IG9wdCB8fCB7fVxuLy8gICBsZXQgZiA9IHRydWUgPT09IGluaXRpYWxcbi8vICAgICA/IGZlbmNlKCkgOiBpbml0aWFsXG4vL1xuLy8gICB3aGlsZSAhIGZlbmNlLmRvbmUgOjpcbi8vICAgICBsZXQgdlxuLy8gICAgIGlmIHRyYWlsaW5nIDo6XG4vLyAgICAgICB2ID0gYXdhaXQgZlxuLy8gICAgICAgZiA9IGZlbmNlKClcbi8vXG4vLyAgICAgZWxzZSA6OlxuLy8gICAgICAgZiA9IGZlbmNlKClcbi8vICAgICAgIHYgPSBhd2FpdCBmXG4vL1xuLy8gICAgIGlmIGZlbmNlLmRvbmUgOjpcbi8vICAgICAgIHJldHVybiB2XG4vL1xuLy8gICAgIGlmIF9pc19mbihzaWduYWwpIDo6XG4vLyAgICAgICB5aWVsZCBzaWduYWwodilcbi8vICAgICBlbHNlIGlmIHNpZ25hbCA6OlxuLy8gICAgICAgeWllbGQgc2lnbmFsXG4vLyAgICAgZWxzZSB5aWVsZCB2XG5cbmFzeW5jIGZ1bmN0aW9uIGFvX3J1bihnZW5faW4sIG5vdGlmeT1fcmV0X2lkZW50KSB7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgX3hpbnZva2UkMShnZW5faW4pKSB7XG4gICAgbm90aWZ5KHYpO30gfVxuXG5cbmFzeW5jIGZ1bmN0aW9uIGFvX2RyaXZlKGdlbl9pbiwgZ2VuX3RndCwgeGZvcm09X3JldF9pZGVudCkge1xuICBnZW5fdGd0ID0gX3hwaXBlX3RndChnZW5fdGd0KTtcbiAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZSQxKGdlbl9pbikpIHtcbiAgICBpZiAodW5kZWZpbmVkICE9PSBnZW5fdGd0KSB7XG4gICAgICB2ID0geGZvcm0odik7XG4gICAgICBsZXQge2RvbmV9ID0gYXdhaXQgZ2VuX3RndC5uZXh0KHYpO1xuICAgICAgaWYgKGRvbmUpIHticmVha30gfSB9IH1cblxuXG5mdW5jdGlvbiBhb19zdGVwX2l0ZXIoaXRlcmFibGUsIG11bHRpcGxlKSB7XG4gIGl0ZXJhYmxlID0gYW9faXRlcihpdGVyYWJsZSk7XG4gIHJldHVybiB7XG4gICAgYXN5bmMgKiBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgICAgZG8ge1xuICAgICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IGl0ZXJhYmxlLm5leHQoKTtcbiAgICAgICAgeWllbGQgdmFsdWU7fVxuICAgICAgd2hpbGUgKG11bHRpcGxlKSB9IH0gfVxuXG5cbmZ1bmN0aW9uIHN0ZXBfaXRlcihpdGVyYWJsZSwgbXVsdGlwbGUpIHtcbiAgaXRlcmFibGUgPSBpdGVyKGl0ZXJhYmxlKTtcbiAgcmV0dXJuIHtcbiAgICAqW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgICBkbyB7XG4gICAgICAgIGxldCB7dmFsdWV9ID0gaXRlcmFibGUubmV4dCgpO1xuICAgICAgICB5aWVsZCB2YWx1ZTt9XG4gICAgICB3aGlsZSAobXVsdGlwbGUpIH0gfSB9XG5cbmZ1bmN0aW9uIGFvX2ZvcmsoKSB7XG4gIHJldHVybiBhb19mZW5jZV9mb3JrKHRoaXMuZmVuY2UpfVxuXG5jb25zdCBfYW9fdGFwX3Byb3BzID17XG4gIGFvX2Zvcms6e3ZhbHVlOiBhb19mb3JrfVxuLCBjaGFpbjp7Z2V0KCkge1xuICAgIHJldHVybiBmbl9jaGFpbih0aGlzLCB0aGlzKX0gfSB9O1xuXG5mdW5jdGlvbiBhb190YXAoYWdfb3V0KSB7XG4gIHJldHVybiBfb2JqX3Byb3BzKF9hb190YXAoYWdfb3V0KSwgX2FvX3RhcF9wcm9wcykgfVxuXG5mdW5jdGlvbiBfYW9fdGFwKGFnX291dCkge1xuICBsZXQgW2ZlbmNlLCByZXNldF0gPSBhb19mZW5jZV92KCk7XG4gIGxldCBnZW4gPSAoKGFzeW5jIGZ1bmN0aW9uICogKCkge1xuICAgIGZlbmNlLmRvbmUgPSBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgZm9yIGF3YWl0IChsZXQgdiBvZiBfeGludm9rZSQxKGFnX291dCkpIHtcbiAgICAgICAgcmVzZXQodik7XG4gICAgICAgIHlpZWxkIHY7fSB9XG4gICAgZmluYWxseSB7XG4gICAgICBmZW5jZS5kb25lID0gdHJ1ZTtcbiAgICAgIHJlc2V0KCk7fSB9KS5jYWxsKHRoaXMpKTtcblxuICBnZW4uZmVuY2UgPSBmZW5jZTtcbiAgcmV0dXJuIGdlbn1cblxuXG5cbmNvbnN0IF9hb19zcGxpdF9hcGkgPXtcbiAgZ2V0IGNoYWluKCkge1xuICAgIHJldHVybiBmbl9jaGFpbih0aGlzLCB0aGlzKX1cbiwgW1N5bWJvbC5hc3luY0l0ZXJhdG9yXTogYW9fZm9ya1xuLCBhb19mb3JrfTtcblxuZnVuY3Rpb24gYW9fc3BsaXQoYWdfb3V0KSB7XG4gIGxldCBnZW4gPSBfYW9fdGFwKGFnX291dCk7XG4gIHJldHVybiB7XG4gICAgX19wcm90b19fOiBfYW9fc3BsaXRfYXBpXG4gICwgZmluOiBhb19ydW4oZ2VuKVxuICAsIGZlbmNlOiBnZW4uZmVuY2V9IH1cblxuY29uc3QgX2FzX3BpcGVfZW5kID0gKGcsbnMpID0+IF9vYmpfYXNzaWduKGcsIG5zKTtcblxuLy9+fn5cbi8vIFBpcGUgYmFzZSBhcyBnZW5lcmF0b3IgaW4gY29tcG9zZWQgb2JqZWN0LWZ1bmN0aW9uYWwgaW1wbGVtZW50YXRpb25cblxuY29uc3QgX2FvX3BpcGVfYmFzZSA9e1xuICB4Zm9sZDogdiA9PiB2IC8vIG9uIHB1c2g6IGlkZW50aXR5IHRyYW5zZm9ybVxuLCB4cHVsbCgpIHt9IC8vIG1lbW9yeTogbm9uZVxuLCB4ZW1pdDogX3hpbnZva2UkMSAvLyBpZGVudGl0eSB0cmFuc2Zvcm0gb3IgaW52b2tlIGlmIGZ1bmN0aW9uXG4sIHhpbml0KGdfaW4sIGFnX291dCkge30gLy8gb24gaW5pdDogZGVmYXVsdCBiZWhhdmlvclxuXG4sIGdldCBjcmVhdGUoKSB7XG4gICAgLy8gYXMgZ2V0dGVyIHRvIGJpbmQgY2xhc3MgYXMgYHRoaXNgIGF0IGFjY2VzcyB0aW1lXG4gICAgY29uc3QgY3JlYXRlID0gKC4uLiBhcmdzKSA9PlxuICAgICAgX29ial9hc3NpZ24oe19fcHJvdG9fXzogdGhpc30sXG4gICAgICAgIC4uLiBhcmdzLm1hcChfeGludm9rZSQxKSlcbiAgICAgIC5fYW9fcGlwZSgpO1xuXG4gICAgcmV0dXJuIGNyZWF0ZS5jcmVhdGUgPSBjcmVhdGV9XG5cbiwgX2FvX3BpcGUoKSB7XG4gICAgbGV0IGZpbl9sc3QgPSBbXTtcbiAgICBsZXQgc2VsZiA9e1xuICAgICAgb25fZmluOiBnID0+KFxuICAgICAgICBmaW5fbHN0LnB1c2goZylcbiAgICAgICwgZylcblxuICAgICwgc3RvcDogKCgpID0+IHtcbiAgICAgICAgdGhpcy5kb25lID0gdHJ1ZTtcbiAgICAgICAgX2Zpbl9waXBlKGZpbl9sc3QpO1xuICAgICAgICB0aGlzLl9yZXN1bWUoKTt9KSB9O1xuXG4gICAgbGV0IHtraW5kfSA9IHRoaXM7XG4gICAgbGV0IGdfaW4gPSBzZWxmLm9uX2Zpbih0aGlzLl9hb19waXBlX2luKHNlbGYuc3RvcCkpO1xuICAgIGxldCBhZ19vdXQgPSBzZWxmLm9uX2Zpbih0aGlzLl9hb19waXBlX291dChzZWxmLnN0b3ApKTtcblxuICAgIHNlbGYuZ19pbiA9IGdfaW4gPSB0aGlzLl9hc19waXBlX2luKGdfaW4sIHNlbGYsIGtpbmQpO1xuICAgIGFnX291dCA9IHRoaXMuX2FzX3BpcGVfb3V0KGFnX291dCwgc2VsZiwga2luZCk7XG5cbiAgICB0aGlzLnhpbml0KGdfaW4sIGFnX291dCk7XG5cbiAgICAvLyBhbGxvdyBnX2luIHRvIGluaXRpYWxpemVcbiAgICBnX2luLm5leHQoKTtcbiAgICByZXR1cm4gYWdfb3V0fVxuXG4sIF9hc19waXBlX2luOiBfYXNfcGlwZV9lbmRcbiwgX2FzX3BpcGVfb3V0OiBfYXNfcGlwZV9lbmRcblxuLCAvL35+flxuICAvLyBVcHN0cmVhbSBpbnB1dCBnZW5lcmF0b3JcbiAgLy8gICBkZXNpZ25lZCBmb3IgbXVsdGlwbGUgZmVlZGVyc1xuXG4gICpfYW9fcGlwZV9pbihfZmluaXNoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCB2O1xuICAgICAgd2hpbGUgKCEgdGhpcy5kb25lKSB7XG4gICAgICAgIHYgPSB0aGlzLnhmb2xkKHlpZWxkIHYpO1xuICAgICAgICB0aGlzLnZhbHVlID0gdjtcbiAgICAgICAgaWYgKDAgIT09IHRoaXMuX3dhaXRpbmcgJiYgdW5kZWZpbmVkICE9PSB2KSB7XG4gICAgICAgICAgdGhpcy5fcmVzdW1lKCk7fSB9IH1cblxuICAgIGZpbmFsbHkge1xuICAgICAgX2ZpbmlzaCgpO30gfVxuXG5cbiwgLy9+fn5cbiAgLy8gRG93bnN0cmVhbSBhc3luYyBvdXRwdXQgZ2VuZXJhdG9yXG4gIC8vICAgZGVzaWduZWQgZm9yIHNpbmdsZSBjb25zdW1lci5cblxuICBhc3luYyAqX2FvX3BpcGVfb3V0KF9maW5pc2gpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IHI7XG4gICAgICB3aGlsZSAoISB0aGlzLmRvbmUpIHtcbiAgICAgICAgaWYgKDAgIT09IChyID0gdGhpcy5fd2FpdGluZykpIHtcbiAgICAgICAgICAvLyBwMDogZXhpc3Rpbmcgd2FpdGVyc1xuICAgICAgICAgIHIgPSBhd2FpdCByO1xuICAgICAgICAgIGlmICh0aGlzLmRvbmUpIHticmVha30gfVxuICAgICAgICBlbHNlIGlmICh1bmRlZmluZWQgIT09IChyID0gdGhpcy52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBwMTogYXZhaWxhYmxlIHZhbHVlXG4gICAgICAgICAgdGhpcy52YWx1ZSA9IHVuZGVmaW5lZDt9XG4gICAgICAgIGVsc2UgaWYgKHVuZGVmaW5lZCAhPT0gKHIgPSB0aGlzLnhwdWxsKCkpKSB7XG4gICAgICAgICAgfS8vIHAyOiB4cHVsbCB2YWx1ZSAoZS5nLiBxdWV1ZSBtZW1vcnkpIFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAvLyBwMzogYWRkIG5ldyB3YWl0ZXJcbiAgICAgICAgICByID0gYXdhaXQgdGhpcy5fYmluZF93YWl0aW5nKCk7XG4gICAgICAgICAgaWYgKHRoaXMuZG9uZSkge2JyZWFrfSB9XG5cbiAgICAgICAgeWllbGQgdGhpcy54ZW1pdChyKTt9IH1cblxuICAgIGZpbmFsbHkge1xuICAgICAgX2ZpbmlzaCgpO30gfVxuXG5cbiwgLy9+fn5cbiAgLy8gZ2VuZXJhdG9yLWxpa2UgdmFsdWUvZG9uZSBzdGF0ZXNcblxuICB2YWx1ZTogdW5kZWZpbmVkXG4sIGRvbmU6IGZhbHNlXG5cbiwgLy9+fn5cbiAgLy8gcHJvbWlzZS1iYXNlZCBmZW5jZSB0YWlsb3JlZCBmb3IgYW9fcGlwZSB1c2VjYXNlXG5cbiAgX3dhaXRpbmc6IDBcbiwgX2Z1bGZpbGwoKSB7fVxuLCBhc3luYyBfcmVzdW1lKCkge1xuICAgIGlmICghIHRoaXMuZG9uZSkge2F3YWl0IHRoaXM7fVxuXG4gICAgbGV0IHt2YWx1ZSwgX2Z1bGZpbGx9ID0gdGhpcztcbiAgICBpZiAodW5kZWZpbmVkICE9IHZhbHVlIHx8IHRoaXMuZG9uZSkge1xuICAgICAgdGhpcy52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSAwO1xuICAgICAgX2Z1bGZpbGwodmFsdWUpO30gfVxuXG4sIF9iaW5kX3dhaXRpbmcoKSB7XG4gICAgbGV0IF9yZXNldCA9IHkgPT4gdGhpcy5fZnVsZmlsbCA9IHk7XG4gICAgdGhpcy5fYmluZF93YWl0aW5nID0gKCkgPT4gdGhpcy5fd2FpdGluZyB8fChcbiAgICAgIHRoaXMuX3dhaXRpbmcgPSBuZXcgUHJvbWlzZShfcmVzZXQpKTtcbiAgICByZXR1cm4gdGhpcy5fYmluZF93YWl0aW5nKCl9IH07XG5cblxuZnVuY3Rpb24gX2Zpbl9waXBlKGZpbl9sc3QpIHtcbiAgd2hpbGUgKDAgIT09IGZpbl9sc3QubGVuZ3RoKSB7XG4gICAgbGV0IGcgPSBmaW5fbHN0LnBvcCgpO1xuICAgIHRyeSB7XG4gICAgICBpZiAoX2lzX2ZuKGcpKSB7ZygpO31cbiAgICAgIGVsc2UgZy5yZXR1cm4oKTt9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvcikge1xuICAgICAgICBpZiAoJ0dlbmVyYXRvciBpcyBhbHJlYWR5IHJ1bm5pbmcnID09PSBlcnIubWVzc2FnZSkge1xuICAgICAgICAgIGNvbnRpbnVlfSB9XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7fSB9IH1cblxuY29uc3QgX2FvX3BpcGVfaW5fYXBpID17XG4gIGFzX3BpcGVfaW4oc2VsZiwgZ19pbikge31cblxuLCB3aXRoX2N0eCh4Y3R4KSB7XG4gICAgaWYgKF9pc19mbih4Y3R4KSkge1xuICAgICAgeGN0eCA9IHhjdHgodGhpcyk7fVxuXG4gICAgaWYgKHhjdHggJiYgeGN0eC5uZXh0KSB7XG4gICAgICB4Y3R4Lm5leHQodGhpcyk7XG4gICAgICB0aGlzLm9uX2Zpbih4Y3R4KTt9XG4gICAgcmV0dXJuIHhjdHh9XG5cbiwgZmVlZCh4c3JjLCB4Zm9ybSkge1xuICAgIHJldHVybiBhb19kcml2ZSh4c3JjLCB0aGlzLCB4Zm9ybSl9XG5cbiwgYmluZF92ZWMoLi4uIGtleXMpIHtcbiAgICByZXR1cm4gdiA9PiB0aGlzLm5leHQoWy4uLmtleXMsIHZdKSB9XG5cbiwgYmluZF9vYmooa2V5LCBucykge1xuICAgIHJldHVybiB2ID0+IHRoaXMubmV4dCh7Li4ubnMsIFtrZXldOiB2fSkgfSB9O1xuXG5mdW5jdGlvbiBfYW9fcGlwZV9pbihnX2luLCBzZWxmKSB7XG4gIHJldHVybiBfb2JqX2Fzc2lnbihnX2luLCBfYW9fcGlwZV9pbl9hcGksIHNlbGYpfVxuXG5jb25zdCBfYW9fcGlwZV9vdXRfa2luZHMgPXtcbiAgYW9fcmF3OiBnID0+IGdcbiwgYW9fc3BsaXQ6IGFvX3NwbGl0XG4sIGFvX3RhcDogYW9fdGFwfTtcblxuZnVuY3Rpb24gX2FvX3BpcGVfb3V0KGFnX291dCwgc2VsZiwga2luZCkge1xuICBraW5kID0gL15hb18vLnRlc3Qoa2luZCkgPyBraW5kIDogJ2FvXycra2luZDtcbiAgbGV0IGFvX3dyYXAgPSBfYW9fcGlwZV9vdXRfa2luZHNba2luZF07XG4gIGlmICh1bmRlZmluZWQgPT09IGFvX3dyYXApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vbnduIGFvX3BpcGVfb3V0IGtpbmQgXCIke2tpbmR9XCJgKX1cblxuICByZXR1cm4gX29ial9hc3NpZ24oYW9fd3JhcChhZ19vdXQpLCBzZWxmKSB9XG5cbmNvbnN0IF9hb19waXBlID17XG4gIF9fcHJvdG9fXzogX2FvX3BpcGVfYmFzZVxuXG4sIC8vIHhmb2xkOiB2ID0+IHYgLS0gb24gcHVzaDogaWRlbnRpdHkgdHJhbnNmb3JtXG4gIC8vIHhwdWxsKCkge30gLS0gbWVtb3J5OiBub25lXG4gIC8vIHhlbWl0OiBfeGludm9rZSAtLSBpZGVudGl0eSB0cmFuc2Zvcm0gb3IgaW52b2tlIGlmIGZ1bmN0aW9uXG5cbiAgLy8gKnhnZm9sZCgpIC0tIG9uIHB1c2g6IGdlbmVyYXRvci1iYXNlZCBmb2xkIGltcGxcbiAgLy8gKnhzcmMoKSAtLSBmZWVkIHdpdGggc291cmNlIGdlbmVyYXRvclxuICAvLyAqeGN0eChnZW5fc3JjKSAtLSBvbiBpbml0OiBiaW5kIGV2ZW50IHNvdXJjZXNcblxuICBraW5kOiAnc3BsaXQnXG4sIF9hc19waXBlX2luOiBfYW9fcGlwZV9pblxuLCBfYXNfcGlwZV9vdXQ6IF9hb19waXBlX291dFxuXG4sIHhpbml0KGdfaW4pIHtcbiAgICBsZXQgeGdmb2xkID0gdGhpcy54Z2ZvbGQ7XG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGdmb2xkKSB7XG4gICAgICB0aGlzLl9pbml0X3hnZm9sZChnX2luLCB4Z2ZvbGQpO31cblxuICAgIHRoaXMuX2luaXRfY2hhaW4oZ19pbik7fVxuXG5cbiwgX2luaXRfeGdmb2xkKGdfaW4sIHhnZm9sZCkge1xuICAgIGlmICh1bmRlZmluZWQgPT09IHhnZm9sZCkge1xuICAgICAgcmV0dXJufVxuXG4gICAgaWYgKF9pc19mbih4Z2ZvbGQpKSB7XG4gICAgICB4Z2ZvbGQgPSB4Z2ZvbGQuY2FsbCh0aGlzLCB0aGlzKTtcblxuICAgICAgaWYgKF9pc19mbih4Z2ZvbGQpKSB7XG4gICAgICAgIHRoaXMueGZvbGQgPSB4Z2ZvbGQ7XG4gICAgICAgIHJldHVybiB0cnVlfVxuXG4gICAgICB4Z2ZvbGQubmV4dCgpO31cblxuICAgIHRoaXMueGdmb2xkID0geGdmb2xkO1xuICAgIHRoaXMueGZvbGQgPSB0aGlzLl9mb2xkX2dlbjtcbiAgICBnX2luLm9uX2Zpbih4Z2ZvbGQpO1xuICAgIHJldHVybiB0cnVlfVxuXG4sIF9mb2xkX2dlbih2KSB7XG4gICAgbGV0IHtkb25lLCB2YWx1ZX0gPSB0aGlzLnhnZm9sZC5uZXh0KHYpO1xuICAgIGlmIChkb25lKSB7dGhpcy5kb25lID0gdHJ1ZTt9XG4gICAgcmV0dXJuIHZhbHVlfVxuXG5cbiwgX2luaXRfY2hhaW4oZ19pbikge1xuICAgIGxldCB7eHNyYywgeGN0eH0gPSB0aGlzO1xuICAgIGlmICh1bmRlZmluZWQgIT09IHhzcmMpIHtcbiAgICAgIGdfaW4uZmVlZCh4c3JjKVxuICAgICAgICAudGhlbiAoKCkgPT5nX2luLnJldHVybigpKTsgfVxuXG4gICAgaWYgKHVuZGVmaW5lZCAhPT0geGN0eCkge1xuICAgICAgZ19pbi53aXRoX2N0eCh4Y3R4KTt9IH0gfTtcblxuXG5jb25zdCBhb19waXBlID0gX2FvX3BpcGUuY3JlYXRlO1xuXG5mdW5jdGlvbiBhb19pbnRlcnZhbChtcz0xMDAwKSB7XG4gIGxldCBbX2ZlbmNlLCBfcmVzZXRdID0gYW9fZmVuY2VfZm4oKTtcbiAgbGV0IHRpZCA9IHNldEludGVydmFsKF9yZXNldCwgbXMsIDEpO1xuICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICBfZmVuY2Uuc3RvcCA9ICgoKSA9PiB7XG4gICAgdGlkID0gY2xlYXJJbnRlcnZhbCh0aWQpO1xuICAgIF9mZW5jZS5kb25lID0gdHJ1ZTt9KTtcbiAgcmV0dXJuIF9mZW5jZX1cblxuXG5mdW5jdGlvbiBhb190aW1lb3V0KG1zPTEwMDApIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKHRpbWVvdXQpO1xuICByZXR1cm4gdGltZW91dFxuXG4gIGZ1bmN0aW9uIHRpbWVvdXQoKSB7XG4gICAgdGlkID0gc2V0VGltZW91dChfcmVzZXQsIG1zLCAxKTtcbiAgICBpZiAodGlkLnVucmVmKSB7dGlkLnVucmVmKCk7fVxuICAgIHJldHVybiBfZmVuY2UoKX0gfVxuXG5cbmZ1bmN0aW9uIGFvX2RlYm91bmNlKG1zPTMwMCwgZ2VuX2luKSB7XG4gIGxldCB0aWQsIFtfZmVuY2UsIF9yZXNldF0gPSBhb19mZW5jZV9mbigpO1xuXG4gIF9mZW5jZS5maW4gPSAoKGFzeW5jICgpID0+IHtcbiAgICBmb3IgYXdhaXQgKGxldCB2IG9mIF94aW52b2tlKGdlbl9pbikpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aWQpO1xuICAgICAgdGlkID0gc2V0VGltZW91dChfcmVzZXQsIG1zLCB2KTt9IH0pKCkpO1xuXG4gIHJldHVybiBfZmVuY2V9XG5cblxuYXN5bmMgZnVuY3Rpb24gKiBhb190aW1lcyhnZW5faW4pIHtcbiAgbGV0IHRzMCA9IERhdGUubm93KCk7XG4gIGZvciBhd2FpdCAobGV0IHYgb2YgZ2VuX2luKSB7XG4gICAgeWllbGQgRGF0ZS5ub3coKSAtIHRzMDt9IH1cblxuZnVuY3Rpb24gYW9fZG9tX2FuaW1hdGlvbigpIHtcbiAgbGV0IHRpZCwgW19mZW5jZSwgX3Jlc2V0XSA9IGFvX2ZlbmNlX2ZuKHJhZik7XG4gIHJhZi5zdG9wID0gKCgpID0+IHtcbiAgICB0aWQgPSBjYW5jZWxBbmltYXRpb25GcmFtZSh0aWQpO1xuICAgIHJhZi5kb25lID0gdHJ1ZTt9KTtcbiAgcmV0dXJuIHJhZlxuXG4gIGZ1bmN0aW9uIHJhZigpIHtcbiAgICB0aWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoX3Jlc2V0KTtcbiAgICByZXR1cm4gX2ZlbmNlKCl9IH1cblxuY29uc3QgYW9fZG9tX2V2ZW50cyA9XG4gIF93bV9waXBlX2Nsb3N1cmUoX2FvX2RvbV9ldmVudHNfY3R4KTtcblxuZnVuY3Rpb24gX2FvX2RvbV9ldmVudHNfY3R4KGdfaW4pIHtcbiAgcmV0dXJuIHtfX3Byb3RvX186IF9kb21fZXZlbnRzX2FwaVxuICAsIHdtX2VsZW1zOiBuZXcgV2Vha01hcCgpXG4gICwgZW1pdDogaW5mbyA9PiBnX2luLm5leHQoaW5mbyl9IH1cblxuXG5jb25zdCBfZG9tX2V2ZW50c19hcGkgPXtcbiAgLy8gd21fZWxlbXM6IG5ldyBXZWFrTWFwKClcbiAgLy8gZW1pdDogaW5mbyA9PiBnX2luLm5leHQoaW5mbylcblxuICBsaXN0ZW4oZWxlbSwgZXZ0LCB4Zm4sIGV2dF9vcHQpIHtcbiAgICBsZXQge2VtaXQsIGluZm99ID0gdGhpcztcbiAgICAge1xuICAgICAgbGV0IGVtID0gX3dtX2l0ZW0odGhpcy53bV9lbGVtcywgZWxlbSwgX2VsZW1fbWFwX2VudHJ5KTtcbiAgICAgIGluZm8gPXsuLi4gaW5mbywgLi4uIGVtLmluZm8sIGV2dH07XG5cbiAgICAgIGxldCBldnQwID0gZXZ0LnNwbGl0KC9bXy5dLywgMSlbMF07XG4gICAgICBpZiAoJ2luaXQnID09PSBldnQwKSB7XG4gICAgICAgIGV2dF9mbihlbGVtKTtcbiAgICAgICAgcmV0dXJuIHRoaXN9XG5cbiAgICAgIGxldCBvbGRfZm4gPSBlbS5nZXQoZXZ0KTtcblxuICAgICAgZWxlbS5hZGRFdmVudExpc3RlbmVyKGV2dDAsIGV2dF9mbiwgZXZ0X29wdCk7XG4gICAgICBlbS5zZXQoZXZ0LCBldnRfZm4pO1xuXG4gICAgICBpZiAodW5kZWZpbmVkICE9PSBvbGRfZm4pIHtcbiAgICAgICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKGV2dDAsIG9sZF9mbik7IH1cblxuICAgICAgaWYgKCdtZXNzYWdlJyA9PT0gZXZ0MCAmJiBfaXNfZm4oZWxlbS5zdGFydCkpIHtcbiAgICAgICAgZWxlbS5zdGFydCgpO30gfVxuXG4gICAgcmV0dXJuIHRoaXNcblxuICAgIGZ1bmN0aW9uIGV2dF9mbihlKSB7XG4gICAgICBsZXQgdiA9IHhmbihlLCBlbWl0LCBpbmZvKTtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IHYpIHtcbiAgICAgICAgZW1pdCh7Li4uIGluZm8sIHZ9KTsgfSB9IH1cblxuXG4sIHJlbW92ZShlbGVtLCAuLi4ga2V5cykge1xuICAgIGxldCB7d21fZWxlbXN9ID0gdGhpcztcbiAgICBsZXQgZXZ0X21hcCA9IHdtX2VsZW1zLmdldChlbGVtKSB8fCBuZXcgTWFwKCk7XG5cbiAgICBsZXQgZXZfcGFpcnM7XG4gICAgaWYgKDAgPT09IGtleXMubGVuZ3RoKSB7XG4gICAgICB3bV9lbGVtcy5kZWxldGUoZWxlbSk7XG4gICAgICBldl9wYWlycyA9IGV2dF9tYXAuZW50cmllcygpO31cblxuICAgIGVsc2Uge1xuICAgICAgZXZfcGFpcnMgPSBrZXlzLm1hcChcbiAgICAgICAgZXZ0MCA9PiBbZXZ0MCwgZXZ0X21hcC5nZXQoZXZ0MCldKTsgfVxuXG4gICAgZm9yIChsZXQgW2V2dDAsIGV2dF9mbl0gb2YgZXZfcGFpcnMpIHtcbiAgICAgIGlmICh1bmRlZmluZWQgIT09IGV2dF9mbikge1xuICAgICAgICBldnRfbWFwLmRlbGV0ZShldnQwKTtcbiAgICAgICAgZWxlbS5yZW1vdmVFdmVudExpc3RlbmVyKGV2dDAsIGV2dF9mbik7fSB9XG4gICAgcmV0dXJuIHRoaXN9XG5cblxuLCBzZXRfaW5mbyhlbCwgaW5mbykge1xuICAgIGxldCBlbSA9IF93bV9pdGVtKHRoaXMud21fZWxlbXMsIGVsLCBfZWxlbV9tYXBfZW50cnkpO1xuICAgIF9vYmpfYXNzaWduKGVtLmluZm8sIGluZm8pO1xuICAgIHJldHVybiB0aGlzfVxuXG4sIHdpdGgoLi4uIG5zX2FyZ3MpIHtcbiAgICBsZXQge2xpc3Rlbiwgc2V0X2luZm8sIGluZm99ID0gdGhpcztcbiAgICBzZXRfaW5mbyA9IHNldF9pbmZvLmJpbmQodGhpcyk7XG5cbiAgICBmb3IgKGxldCBucyBvZiBuc19hcmdzKSB7XG4gICAgICBsZXQgbnNfdGhpcyA9IHVuZGVmaW5lZCA9PT0gbnMuaW5mbyA/IHRoaXMgOlxuICAgICAgICB7X19wcm90b19fOiB0aGlzLCBpbmZvOnsuLi4gaW5mbywgLi4uIG5zLmluZm99fTtcblxuICAgICAgbGV0IGV2ZW50cyA9Wy4uLiBfaXRlcl9ldmVudF9saXN0KG5zKV07XG4gICAgICBmb3IgKGxldCBlbGVtIG9mIF9pdGVyX25hbWVkX2VsZW1zKG5zLiQsIHNldF9pbmZvKSkge1xuICAgICAgICBmb3IgKGxldCBldnRfYXJncyBvZiBldmVudHMpIHtcbiAgICAgICAgICBsaXN0ZW4uY2FsbChuc190aGlzLCBlbGVtLCAuLi4gZXZ0X2FyZ3MpO30gfSB9XG5cbiAgICByZXR1cm4gdGhpc30gfTtcblxuXG5mdW5jdGlvbiBfZWxlbV9tYXBfZW50cnkoZWxlbSkge1xuICBsZXQgayA9IGVsZW0ubmFtZSB8fCBlbGVtLmlkXG4gICAgfHwgKGVsZW0udHlwZSB8fCBlbGVtLnRhZ05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKClcbiAgICB8fCBlbGVtW1N5bWJvbC50b1N0cmluZ1RhZ107XG5cbiAgbGV0IG0gPSBuZXcgTWFwKCk7XG4gIG0uaW5mbyA9e2RvbV9pdGVtOiBrLCBrfTtcbiAgcmV0dXJuIG19XG5cblxuZnVuY3Rpb24gKiBfaXRlcl9uYW1lZF9lbGVtcyhsc3QsIHNldF9pbmZvKSB7XG4gIGxzdCA9IF9pc19hcnJheShsc3QpID8gbHN0XG4gICAgOiBsc3QuYWRkRXZlbnRMaXN0ZW5lciA/IFtsc3RdXG4gICAgOiBPYmplY3QuZW50cmllcyhsc3QpO1xuXG4gIGZvciAobGV0IGVhIG9mIGxzdCkge1xuICAgIGlmIChfaXNfYXJyYXkoZWEpKSB7XG4gICAgICBzZXRfaW5mbyhlYVsxXSwge2s6IGVhWzBdfSk7XG4gICAgICB5aWVsZCBlYVsxXTt9XG5cbiAgICBlbHNlIHlpZWxkIGVhO30gfVxuXG5cbmZ1bmN0aW9uICogX2l0ZXJfZXZlbnRfbGlzdChucykge1xuICBmb3IgKGxldCBbYXR0ciwgZWZuXSBvZiBPYmplY3QuZW50cmllcyhucykpIHtcbiAgICBpZiAoISBlZm4gfHwgL1teYS16XS8udGVzdChhdHRyKSkge1xuICAgICAgY29udGludWV9XG5cbiAgICBhdHRyID0gYXR0ci5yZXBsYWNlKCdfJywgJy4nKTtcbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGVmbikge1xuICAgICAgeWllbGQgW2F0dHIsIGVmbiwgZWZuLmV2dF9vcHRdO31cblxuICAgIGVsc2UgaWYgKGVmbi5vbl9ldnQgfHwgZWZuLmV2dF9vcHQpIHtcbiAgICAgIHlpZWxkIFthdHRyLCBlZm4ub25fZXZ0LCBlZm4uZXZ0X29wdF07fSB9IH1cblxuZXhwb3J0IHsgX2FvX2RvbV9ldmVudHNfY3R4LCBfYW9fcGlwZSwgX2FvX3BpcGVfYmFzZSwgX2FvX3BpcGVfaW4sIF9hb19waXBlX2luX2FwaSwgX2FvX3BpcGVfb3V0LCBfYW9fcGlwZV9vdXRfa2luZHMsIF9hb190YXAsIF9kb21fZXZlbnRzX2FwaSwgX3dtX2Nsb3N1cmUsIF93bV9pdGVtLCBfd21fcGlwZV9jbG9zdXJlLCBfeGludm9rZSQxIGFzIF94aW52b2tlLCBfeHBpcGVfdGd0LCBhb19kZWJvdW5jZSwgYW9fZGVmZXJyZWQsIGFvX2RlZmVycmVkX3YsIGFvX2RvbV9hbmltYXRpb24sIGFvX2RvbV9ldmVudHMsIGFvX2RyaXZlLCBhb19mZW5jZV9mbiwgYW9fZmVuY2VfZm9yaywgYW9fZmVuY2Vfb2JqLCBhb19mZW5jZV92LCBhb19pbnRlcnZhbCwgYW9faXRlciwgYW9fcGlwZSwgYW9fcnVuLCBhb19zcGxpdCwgYW9fc3RlcF9pdGVyLCBhb190YXAsIGFvX3RpbWVvdXQsIGFvX3RpbWVzLCBmbl9jaGFpbiwgaXNfYW9faXRlciwgaXRlciwgc3RlcF9pdGVyIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yb2FwLm1qcy5tYXBcbiIsImltcG9ydCB7YXNzZXJ0LCBpc19mbn0gZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5pbXBvcnQge2FvX2RlZmVycmVkLCBhb19kZWZlcnJlZF92fSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19mZW5jZV92LCBhb19mZW5jZV9mbiwgYW9fZmVuY2Vfb2JqfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHtpdGVyLCBzdGVwX2l0ZXIsIGFvX2l0ZXIsIGFvX3N0ZXBfaXRlcn0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fcnVuLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcbmltcG9ydCB7YW9fcGlwZX0gZnJvbSAncm9hcCdcblxuZGVzY3JpYmUgQCAnc21va2UnLCBAOjpcbiAgaXQgQCAnZGVmZXJyZWQnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RlZmVycmVkXG4gICAgaXNfZm4gQCBhb19kZWZlcnJlZF92XG5cbiAgaXQgQCAnZmVuY2UnLCBAOjpcbiAgICBpc19mbiBAIGFvX2ZlbmNlX3ZcbiAgICBpc19mbiBAIGFvX2ZlbmNlX2ZuXG4gICAgaXNfZm4gQCBhb19mZW5jZV9vYmpcblxuICBpdCBAICdkcml2ZScsIEA6OlxuICAgIGlzX2ZuIEAgaXRlclxuICAgIGlzX2ZuIEAgc3RlcF9pdGVyXG4gICAgaXNfZm4gQCBhb19pdGVyXG4gICAgaXNfZm4gQCBhb19zdGVwX2l0ZXJcbiAgICBcbiAgICBpc19mbiBAIGFvX3J1blxuICAgIGlzX2ZuIEAgYW9fZHJpdmVcblxuICBpdCBAICdzcGxpdCcsIEA6OlxuICAgIGlzX2ZuIEAgYW9fc3BsaXRcbiAgICBpc19mbiBAIGFvX3RhcFxuXG4gIGl0IEAgJ3BpcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX3BpcGVcblxuIiwiaW1wb3J0IHthb19kZWZlcnJlZCwgYW9fZGVmZXJyZWRfdn0gZnJvbSAncm9hcCdcbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fZGVmZXJyZWQnLCBAOjpcblxuICBkZXNjcmliZSBAICdhb19kZWZlcnJlZF92IHR1cGxlJywgQDo6XG4gICAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICAgIGNvbnN0IHJlcyA9IGFvX2RlZmVycmVkX3YoKVxuICAgICAgZXhwZWN0KHJlcykudG8uYmUuYW4oJ2FycmF5Jykub2YubGVuZ3RoKDMpXG4gICAgICBleHBlY3QocmVzWzBdKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChyZXNbMV0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXNbMl0pLnRvLmJlLmEoJ2Z1bmN0aW9uJylcblxuICAgIGl0IEAgJ3VzZSwgcmVzb2x2ZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJyZWRfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlc29sdmUoJ3l1cCcpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAneXVwJywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICBpdCBAICd1c2UsIHJlamVjdCcsIEA6Oj5cbiAgICAgIGNvbnN0IFtwLCByZXNvbHZlLCByZWplY3RdID0gYW9fZGVmZXJyZWRfdigpXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlamVjdCBAIG5ldyBFcnJvcignbm9wZScpXG5cbiAgICAgIHRyeSA6OlxuICAgICAgICBhd2FpdCBwXG4gICAgICAgIGFzc2VydC5mYWlsKClcbiAgICAgIGNhdGNoIGVyciA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAnbm9wZScsIGVyci5tZXNzYWdlXG5cblxuXG4gIGRlc2NyaWJlIEAgJ2FvX2RlZmVycmVkIG9iamVjdCcsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZCgpXG4gICAgICBleHBlY3QocmVzKS50by5iZS5hbignb2JqZWN0JylcbiAgICAgIGV4cGVjdChyZXMucHJvbWlzZSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QocmVzLnJlc29sdmUpLnRvLmJlLmEoJ2Z1bmN0aW9uJylcbiAgICAgIGV4cGVjdChyZXMucmVqZWN0KS50by5iZS5hKCdmdW5jdGlvbicpXG5cbiAgICBpdCBAICd1c2UsIHJlc29sdmUnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZCgpXG4gICAgICBsZXQgcCA9IHJlcy5wcm9taXNlXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZXNvbHZlKCd5dXAnKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3l1cCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuXG4gICAgaXQgQCAndXNlLCByZWplY3QnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19kZWZlcnJlZCgpXG4gICAgICBsZXQgcCA9IHJlcy5wcm9taXNlXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZWplY3QgQCBuZXcgRXJyb3IoJ25vcGUnKVxuXG4gICAgICB0cnkgOjpcbiAgICAgICAgYXdhaXQgcFxuICAgICAgICBhc3NlcnQuZmFpbCgpXG4gICAgICBjYXRjaCBlcnIgOjpcbiAgICAgICAgYXNzZXJ0LmVxdWFsIEAgJ25vcGUnLCBlcnIubWVzc2FnZVxuXG4iLCJpbXBvcnQge2FvX2ZlbmNlX29iaiwgYW9fZmVuY2Vfdn0gZnJvbSAncm9hcCdcbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LFxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgYW9fZmVuY2UnLCBAOjpcbiAgZGVzY3JpYmUgQCAnYW9fZmVuY2VfdiB0dXBsZScsIEA6OlxuICAgIGl0IEAgJ3NoYXBlJywgQDo6XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV92KClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdhcnJheScpLm9mLmxlbmd0aCgyKVxuICAgICAgZXhwZWN0KHJlc1swXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlc1sxXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcblxuICAgICAgY29uc3QgcCA9IGZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlc3VtZSgxOTQyKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICAgIGl0IEAgJ29ubHkgZmlyc3QgYWZ0ZXInLCBAOjo+XG4gICAgICBjb25zdCBbZmVuY2UsIHJlc3VtZV0gPSBhb19mZW5jZV92KClcbiAgICAgIGxldCBmXG5cbiAgICAgIHJlc3VtZSBAICdvbmUnXG4gICAgICBmID0gZmVuY2UoKVxuICAgICAgcmVzdW1lIEAgJ3R3bydcbiAgICAgIHJlc3VtZSBAICd0aHJlZSdcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3R3bycsIGF3YWl0IGZcblxuICAgICAgcmVzdW1lIEAgJ2ZvdXInXG4gICAgICByZXN1bWUgQCAnZml2ZSdcbiAgICAgIGYgPSBmZW5jZSgpXG4gICAgICByZXN1bWUgQCAnc2l4J1xuICAgICAgcmVzdW1lIEAgJ3NldmVuJ1xuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAnc2l4JywgYXdhaXQgZlxuXG5cbiAgICBpdCBAICduZXZlciBibG9ja2VkIG9uIGZlbmNlJywgQDo6PlxuICAgICAgY29uc3QgW2ZlbmNlLCByZXN1bWVdID0gYW9fZmVuY2VfdigpXG5cbiAgICAgIHJlc3VtZSBAICdvbmUnXG4gICAgICByZXN1bWUgQCAndHdvJ1xuICAgICAgcmVzdW1lIEAgJ3RocmVlJ1xuXG5cbiAgICBpdCBAICdleGVyY2lzZSBmZW5jZScsIEA6Oj5cbiAgICAgIGNvbnN0IFtmZW5jZSwgcmVzdW1lXSA9IGFvX2ZlbmNlX3YoKVxuXG4gICAgICBsZXQgdiA9ICdhJ1xuICAgICAgZXhwZWN0KHYpLnRvLmVxdWFsKCdhJylcblxuICAgICAgY29uc3QgcCA9IEAhPlxuICAgICAgICB2ID0gJ2InXG5cbiAgICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnYmInKVxuXG4gICAgICAgIHYgPSAnYydcbiAgICAgICAgOjogY29uc3QgYW5zID0gYXdhaXQgZmVuY2UoKVxuICAgICAgICAgICBleHBlY3QoYW5zKS50by5lcXVhbCgnY2MnKVxuICAgICAgICB2ID0gJ2QnXG4gICAgICAgIHJldHVybiAxOTQyXG5cbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuXG4gICAgICA6OlxuICAgICAgICBjb25zdCBwID0gcmVzdW1lKHYrdilcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLnVuZGVmaW5lZFxuXG4gICAgICBleHBlY3QodikudG8uZXF1YWwoJ2InKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG5cbiAgICAgIDo6XG4gICAgICAgIGNvbnN0IHAgPSByZXN1bWUodit2KVxuICAgICAgICBleHBlY3QocCkudG8uYmUudW5kZWZpbmVkXG5cbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnYycpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAxOTQyLCBhd2FpdCBkZWxheV9yYWNlKHAsMSlcbiAgICAgIGV4cGVjdCh2KS50by5lcXVhbCgnZCcpXG5cblxuICBkZXNjcmliZSBAICdhb19mZW5jZSBvYmplY3QnLCBAOjpcbiAgICBpdCBAICdzaGFwZScsIEA6OlxuICAgICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcbiAgICAgIGV4cGVjdChyZXMpLnRvLmJlLmFuKCdvYmplY3QnKVxuICAgICAgZXhwZWN0KHJlcy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5yZXNldCkudG8uYmUuYSgnZnVuY3Rpb24nKVxuICAgICAgZXhwZWN0KHJlcy5hb19mb3JrKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QocmVzW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG5cbiAgICBpdCBAICdiYXNpYyB1c2UnLCBAOjo+XG4gICAgICBjb25zdCByZXMgPSBhb19mZW5jZV9vYmooKVxuXG4gICAgICBjb25zdCBwID0gcmVzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cbiAgICAgIHJlcy5yZXNldCgxOTQyKVxuICAgICAgYXNzZXJ0LmVxdWFsIEAgMTk0MiwgYXdhaXQgZGVsYXlfcmFjZShwLDEpXG5cblxuICAgIGl0IEAgJ2FzeW5jIGl0ZXIgdXNlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgICAgZGVsYXkoKS50aGVuIEA9PiByZXMucmVzZXQoJ3JlYWR5JylcblxuICAgICAgZm9yIGF3YWl0IGxldCB2IG9mIHJlcyA6OlxuICAgICAgICBhc3NlcnQuZXF1YWwgQCAncmVhZHknLCB2XG4gICAgICAgIGJyZWFrXG5cblxuICAgIGl0IEAgJ2FzeW5jIGl0ZXIgbXVsdGkgdXNlJywgQDo6PlxuICAgICAgY29uc3QgcmVzID0gYW9fZmVuY2Vfb2JqKClcblxuICAgICAgbGV0IHBhID0gQCE+XG4gICAgICAgIGZvciBhd2FpdCBsZXQgdiBvZiByZXMgOjpcbiAgICAgICAgICByZXR1cm4gYHBhICR7dn1gXG5cbiAgICAgIGxldCBwYiA9IEAhPlxuICAgICAgICBmb3IgYXdhaXQgbGV0IHYgb2YgcmVzLmFvX2ZvcmsoKSA6OlxuICAgICAgICAgIHJldHVybiBgcGIgJHt2fWBcblxuICAgICAgbGV0IHBjID0gcmVzLmZlbmNlKClcblxuICAgICAgYXNzZXJ0LmVxdWFsIEAgJ3RpbWVvdXQnLCBhd2FpdCBkZWxheV9yYWNlKHBhLDEpXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICd0aW1lb3V0JywgYXdhaXQgZGVsYXlfcmFjZShwYywxKVxuXG4gICAgICByZXMucmVzZXQoJ3JlYWR5JylcbiAgICAgIGFzc2VydC5lcXVhbCBAICdwYSByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGEsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICdwYiByZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGIsMSlcbiAgICAgIGFzc2VydC5lcXVhbCBAICdyZWFkeScsIGF3YWl0IGRlbGF5X3JhY2UocGMsMSlcblxuIiwiaW1wb3J0IHthb19ydW4sIGFvX2RyaXZlfSBmcm9tICdyb2FwJ1xuXG5pbXBvcnQgQHt9XG4gIGFzc2VydCwgZXhwZWN0LFxuICBkZWxheV9yYWNlLCBkZWxheSwgZGVsYXlfd2Fsa1xuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgZHJpdmUnLCBAOjpcblxuICBpdCBAICdhb19ydW4nLCBAOjo+XG4gICAgbGV0IGxzdCA9IFtdXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX3J1biBAIGcsIHYgPT4gbHN0LnB1c2godilcblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbHN0LCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG4gIGl0IEAgJ2FvX2RyaXZlIGdlbmVyYXRvcicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZ190Z3QgPSBnZW5fdGVzdChsc3QpXG4gICAgZ190Z3QubmV4dCgnZmlyc3QnKVxuICAgIGdfdGd0Lm5leHQoJ3NlY29uZCcpXG4gICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICBsZXQgcCA9IGFvX2RyaXZlIEAgZywgZ190Z3QsIHYgPT4gWyd4ZScsIHZdXG5cbiAgICBleHBlY3QocCkudG8uYmUuYShcInByb21pc2VcIilcbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgcCwgdW5kZWZpbmVkXG4gICAgZ190Z3QubmV4dCgnZmluYWwnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxzdCwgQFtdXG4gICAgICAnc2Vjb25kJ1xuICAgICAgQFtdICd4ZScsIDE5NDJcbiAgICAgIEBbXSAneGUnLCAyMDQyXG4gICAgICBAW10gJ3hlJywgMjE0MlxuICAgICAgJ2ZpbmFsJ1xuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdChsc3QpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuICBpdCBAICdhb19kcml2ZSBmdW5jdGlvbicsIEA6Oj5cbiAgICBsZXQgbHN0ID0gW11cbiAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgIGxldCBwID0gYW9fZHJpdmUgQCBnLCBnZW5fdGVzdCwgdiA9PiBbJ3hlJywgdl1cblxuICAgIGV4cGVjdChwKS50by5iZS5hKFwicHJvbWlzZVwiKVxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCBwLCB1bmRlZmluZWRcblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsc3QsIEBbXVxuICAgICAgQFtdICd4ZScsIDE5NDJcbiAgICAgIEBbXSAneGUnLCAyMDQyXG4gICAgICBAW10gJ3hlJywgMjE0MlxuXG4gICAgZnVuY3Rpb24gKiBnZW5fdGVzdCgpIDo6XG4gICAgICB3aGlsZSAxIDo6XG4gICAgICAgIGxldCB2ID0geWllbGRcbiAgICAgICAgbHN0LnB1c2godilcblxuIiwiaW1wb3J0IHtpdGVyLCBhb19pdGVyfSBmcm9tICdyb2FwJ1xuaW1wb3J0IHthb19zdGVwX2l0ZXIsIHN0ZXBfaXRlcn0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19nZW5cbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIGRyaXZlIGl0ZXJzJywgQDo6XG5cbiAgaXQgQCAnbm9ybWFsIGl0ZXInLCBAOjpcbiAgICBsZXQgZyA9IGlzX2dlbiBAIGl0ZXIgQCMgMTAsIDIwLCAzMFxuICAgIGFzc2VydC5kZWVwRXF1YWwgQCB7dmFsdWU6IDEwLCBkb25lOiBmYWxzZX0sIGcubmV4dCgpXG5cblxuICBpdCBAICdhc3luYyBpdGVyJywgQDo6PlxuICAgIGxldCBnID0gaXNfZ2VuIEAgYW9faXRlciBAIyAxMCwgMjAsIDMwXG5cbiAgICBsZXQgcCA9IGcubmV4dCgpXG4gICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHt2YWx1ZTogMTAsIGRvbmU6IGZhbHNlfSwgYXdhaXQgcFxuXG5cbiAgaXQgQCAnbm9ybWFsIHN0ZXBfaXRlcicsIEA6OlxuICAgIGxldCB6ID0gQXJyYXkuZnJvbSBAXG4gICAgICB6aXAgQFxuICAgICAgICBbMTAsIDIwLCAzMF1cbiAgICAgICAgWydhJywgJ2InLCAnYyddXG5cbiAgICBhc3NlcnQuZGVlcEVxdWFsIEAgeiwgQFtdXG4gICAgICBbMTAsICdhJ11cbiAgICAgIFsyMCwgJ2InXVxuICAgICAgWzMwLCAnYyddXG5cbiAgICBmdW5jdGlvbiAqIHppcChhLCBiKSA6OlxuICAgICAgYiA9IHN0ZXBfaXRlcihiKVxuICAgICAgZm9yIGxldCBhdiBvZiBpdGVyKGEpIDo6XG4gICAgICAgIGZvciBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cblxuICBpdCBAICdhc3luYyBhb19zdGVwX2l0ZXInLCBAOjo+XG4gICAgbGV0IHogPSBhd2FpdCBhcnJheV9mcm9tX2FvX2l0ZXIgQFxuICAgICAgYW9femlwIEBcbiAgICAgICAgWzEwLCAyMCwgMzBdXG4gICAgICAgIFsnYScsICdiJywgJ2MnXVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAIHosIEBbXVxuICAgICAgWzEwLCAnYSddXG4gICAgICBbMjAsICdiJ11cbiAgICAgIFszMCwgJ2MnXVxuXG5cbiAgICBhc3luYyBmdW5jdGlvbiAqIGFvX3ppcChhLCBiKSA6OlxuICAgICAgYiA9IGFvX3N0ZXBfaXRlcihiKVxuICAgICAgZm9yIGF3YWl0IGxldCBhdiBvZiBhb19pdGVyKGEpIDo6XG4gICAgICAgIGZvciBhd2FpdCBsZXQgYnYgb2YgYiA6OlxuICAgICAgICAgIHlpZWxkIFthdiwgYnZdXG5cbiIsImltcG9ydCB7YW9fc3BsaXQsIGFvX3RhcH0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGssXG4gIGFycmF5X2Zyb21fYW9faXRlcixcbiAgaXNfZm4sIGlzX2dlbiwgaXNfYXN5bmNfaXRlcmFibGVcbmZyb20gJy4vX3V0aWxzLmpzeSdcblxuXG5kZXNjcmliZSBAICdjb3JlIHNwbGl0JywgQDo6XG5cbiAgZGVzY3JpYmUgQCAnYW9fc3BsaXQnLCBAOjpcbiAgICBpdCBAICd0cmlwbGUnLCBAOjo+XG4gICAgICBsZXQgZyA9IGRlbGF5X3dhbGsgQCMgMTk0MiwgMjA0MiwgMjE0MlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19zcGxpdChnKVxuXG4gICAgICBleHBlY3QoZ3MuZmluKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChiKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGxldCBjID0gYXJyYXlfZnJvbV9hb19pdGVyKGdzLmFvX2ZvcmsoKSlcbiAgICAgIGV4cGVjdChjKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgYXNzZXJ0LmVxdWFsKGF3YWl0IHAsIDE5NDIpXG5cbiAgICAgIHAgPSBncy5mZW5jZSgpXG4gICAgICBhc3NlcnQuZXF1YWwoYXdhaXQgcCwgMjA0MilcblxuICAgICAgcCA9IGdzLmZlbmNlKClcbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAyMTQyKVxuXG4gICAgICBhd2FpdCBncy5maW5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhID0gYXdhaXQgYSwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBiID0gYXdhaXQgYiwgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBjID0gYXdhaXQgYywgQFtdIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgYXNzZXJ0IEAgYSAhPT0gYlxuICAgICAgYXNzZXJ0IEAgYSAhPT0gY1xuICAgICAgYXNzZXJ0IEAgYiAhPT0gY1xuXG5cbiAgZGVzY3JpYmUgQCAnYW9fdGFwJywgQDo6XG4gICAgaXQgQCAndHJpcGxlJywgQDo6PlxuICAgICAgbGV0IGcgPSBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9fdGFwKGcpXG5cbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgbGV0IGMgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgZXhwZWN0KGMpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBhc3NlcnQuZXF1YWwgQCAndGltZW91dCcsIGF3YWl0IGRlbGF5X3JhY2UocCwxKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG5cbiAgICAgIGFzc2VydC5lcXVhbChhd2FpdCBwLCAxOTQyKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYSA9IGF3YWl0IGEsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYiA9IGF3YWl0IGIsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYyA9IGF3YWl0IGMsIEBbXSAxOTQyLCAyMDQyLCAyMTQyXG5cbiAgICAgIGFzc2VydCBAIGEgIT09IGJcbiAgICAgIGFzc2VydCBAIGEgIT09IGNcbiAgICAgIGFzc2VydCBAIGIgIT09IGNcblxuIiwiaW1wb3J0IHtfYW9fcGlwZV9iYXNlLCBhb19kcml2ZX0gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXlfcmFjZSwgZGVsYXksIGRlbGF5X3dhbGtcbiAgYXJyYXlfZnJvbV9hb19pdGVyLFxuICBpc19mbiwgaXNfZ2VuLCBpc19hc3luY19pdGVyYWJsZVxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2NvcmUgX2FvX3BpcGVfYmFzZScsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBwaXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBfYW9fcGlwZV9iYXNlLmNyZWF0ZSgpXG4gICAgaXNfZ2VuIEAgcGlwZS5nX2luXG5cblxuICBpdCBAICdleGFtcGxlJywgQDo6PlxuICAgIGxldCBwaXBlID0gX2FvX3BpcGVfYmFzZS5jcmVhdGUoKVxuICAgIGxldCB6ID0gY29tbW9uX2FvX3BpcGVfYmFzZSBAIHBpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDIwNDIsIDIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cbiAgaXQgQCAneGZvbGQnLCBAOjo+XG4gICAgbGV0IHBpcGUgPSBfYW9fcGlwZV9iYXNlLmNyZWF0ZSBAOjpcbiAgICAgIGxldCBzID0gMFxuICAgICAgcmV0dXJuIEB7fSB4Zm9sZDogdiA9PiBzICs9IHZcblxuICAgIGxldCB6ID0gY29tbW9uX2FvX3BpcGVfYmFzZSBAIHBpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIDE5NDIsIDE5NDIrMjA0MiwgMTk0MisyMDQyKzIxNDJcbiAgICAgIGF3YWl0IGRlbGF5X3JhY2UoeiwgNTApXG5cblxuICBpdCBAICd4ZW1pdCcsIEA6Oj5cbiAgICBsZXQgcGlwZSA9IF9hb19waXBlX2Jhc2UuY3JlYXRlIEA6XG4gICAgICB4ZW1pdDogdiA9PiBbJ3hlJywgdl1cblxuICAgIGxldCB6ID0gY29tbW9uX2FvX3BpcGVfYmFzZSBAIHBpcGUsXG4gICAgICBbMTk0MiwgMjA0MiwgMjE0Ml1cblxuICAgIGFzc2VydC5kZWVwRXF1YWwgQFxuICAgICAgQFtdIFsneGUnLCAxOTQyXVxuICAgICAgICAgIFsneGUnLCAyMDQyXVxuICAgICAgICAgIFsneGUnLCAyMTQyXVxuICAgICAgYXdhaXQgZGVsYXlfcmFjZSh6LCA1MClcblxuXG4gIGl0IEAgJ3hwdWxsJywgQDo6PlxuICAgIGxldCBwaXBlID0gX2FvX3BpcGVfYmFzZS5jcmVhdGUgQDo6XG4gICAgICBsZXQgbWVtID0gW11cbiAgICAgIHJldHVybiBAe31cbiAgICAgICAgeGZvbGQodikgOjpcbiAgICAgICAgICBpZiB1bmRlZmluZWQgIT09IHYgOjpcbiAgICAgICAgICAgIG1lbS5wdXNoKHYpXG4gICAgICAgICAgcmV0dXJuIG1lbVswXVxuICAgICAgICB4cHVsbCgpIDo6XG4gICAgICAgICAgcmV0dXJuIG1lbVswXVxuICAgICAgICB4ZW1pdCgpIDo6XG4gICAgICAgICAgbGV0IHRpcCA9IG1lbS5zaGlmdCgpXG4gICAgICAgICAgbGV0IHEgPSBtZW0uc2xpY2UoKVxuICAgICAgICAgIHJldHVybiBAe30gdGlwLCBxXG5cbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgIGZvciBsZXQgdiBvZiBbMTk0MiwgMjA0MiwgMjE0Ml0gOjpcbiAgICAgIHBpcGUuZ19pbi5uZXh0KHYpXG5cbiAgICBhd2FpdCBkZWxheSgxKVxuICAgIHBpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgYXNzZXJ0LmRlZXBFcXVhbCBAXG4gICAgICBAW11cbiAgICAgICAgQHt9IHRpcDogMTk0MiwgcTogQFtdIDIwNDIsIDIxNDJcbiAgICAgICAgQHt9IHRpcDogMjA0MiwgcTogQFtdIDIxNDJcbiAgICAgICAgQHt9IHRpcDogMjE0MiwgcTogQFtdXG4gICAgICBhd2FpdCB6XG5cblxuICBhc3luYyBmdW5jdGlvbiBjb21tb25fYW9fcGlwZV9iYXNlKHBpcGUsIHZhbHVlcykgOjpcbiAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuXG4gICAgYXdhaXQgYW9fZHJpdmUgQFxuICAgICAgZGVsYXlfd2Fsayh2YWx1ZXMpXG4gICAgICBwaXBlLmdfaW5cblxuICAgIHBpcGUuZ19pbi5yZXR1cm4oKVxuXG4gICAgcmV0dXJuIHpcblxuIiwiaW1wb3J0IHthb19waXBlLCBhb19pdGVyLCBhb19ydW59IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGRlbGF5X3JhY2UsIGRlbGF5LCBkZWxheV93YWxrLFxuICBhcnJheV9mcm9tX2FvX2l0ZXIsXG4gIGlzX2ZuLCBpc19nZW4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnY29yZSBhb19waXBlJywgZnVuY3Rpb24oKSA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGxldCBwaXBlID0gaXNfYXN5bmNfaXRlcmFibGUgQCBhb19waXBlKClcbiAgICBpc19nZW4gQCBwaXBlLmdfaW5cblxuXG4gIGRlc2NyaWJlIEAgJ2NvbXB1dGUnLCBAOjpcbiAgICBpdCBAICd4Zm9sZCcsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgIHhmb2xkOiB2ID0+IDEwMDAgKyB2XG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgYXdhaXQgeiwgQFtdIDEwMzAsIDEwMjAsIDEwMTBcblxuXG4gICAgaXQgQCAnKnhnZm9sZCcsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSBAOlxuICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgICp4Z2ZvbGQoKSA6OlxuICAgICAgICAgIGxldCBzID0gMFxuICAgICAgICAgIHdoaWxlIDEgOjpcbiAgICAgICAgICAgIGxldCB2ID0geWllbGQgc1xuICAgICAgICAgICAgcyArPSB2ICsgMTAwMFxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAxMDMwLCAyMDUwLCAzMDYwXG5cblxuICAgIGl0IEAgJ3hzcmMnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwyMCwxMFxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAzMCwyMCwxMFxuXG5cbiAgICBpdCBAICd4Y3R4JywgQDo6PlxuICAgICAgbGV0IGxvZz1bXVxuXG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUgQDpcbiAgICAgICAgKnhjdHgoZ19pbikgOjpcbiAgICAgICAgICBsb2cucHVzaCBAICd4Y3R4IHN0YXJ0J1xuICAgICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgICB2ID0+IGdfaW4ubmV4dCh2KVxuICAgICAgICAgICAgMSwgJ2JpbmdvJ1xuXG4gICAgICAgICAgdHJ5IDo6IHlpZWxkXG4gICAgICAgICAgZmluYWxseSA6OlxuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpZClcbiAgICAgICAgICAgIGxvZy5wdXNoIEAgJ3hjdHggZmluJ1xuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihwaXBlKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnXG5cbiAgICAgIGF3YWl0IGRlbGF5KDUpXG4gICAgICBwaXBlLnN0b3AoKVxuXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgbG9nLCBAW10gJ3hjdHggc3RhcnQnLCAneGN0eCBmaW4nXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gJ2JpbmdvJ1xuXG5cbiAgZGVzY3JpYmUgQCAnZ19pbjogc291cmNlIGdlbmVyYXRvciBmZWVkJywgQDo6XG4gICAgaXQgQCAnd2l0aCcsIEA6Oj5cbiAgICAgIGxldCBsb2c9W11cblxuICAgICAgbGV0IHBpcGUgPSBhb19waXBlKClcblxuICAgICAgcGlwZS5nX2luLndpdGhfY3R4IEBcXCBnX2luIDo6KlxuICAgICAgICBsb2cucHVzaCBAICdnX2luLndpdGggc3RhcnQnXG4gICAgICAgIGxldCB0aWQgPSBzZXRUaW1lb3V0IEAgXG4gICAgICAgICAgdiA9PiBnX2luLm5leHQodilcbiAgICAgICAgICAxLCAnYmluZ28nXG5cbiAgICAgICAgdHJ5IDo6IHlpZWxkXG4gICAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGlkKVxuICAgICAgICAgIGxvZy5wdXNoIEAgJ2dfaW4ud2l0aCBmaW4nXG5cbiAgICAgIGxldCB6ID0gYXJyYXlfZnJvbV9hb19pdGVyKHBpcGUpXG5cbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBsb2csIEBbXSAnZ19pbi53aXRoIHN0YXJ0J1xuXG4gICAgICBhd2FpdCBkZWxheSg1KVxuICAgICAgcGlwZS5zdG9wKClcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGxvZywgQFtdICdnX2luLndpdGggc3RhcnQnLCAnZ19pbi53aXRoIGZpbidcblxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbCBAIGF3YWl0IHosIEBbXSAnYmluZ28nXG5cblxuICAgIGl0IEAgJ2ZlZWQnLCBAOjo+XG4gICAgICBsZXQgcGlwZSA9IGFvX3BpcGUoKVxuICAgICAgbGV0IHogPSBhcnJheV9mcm9tX2FvX2l0ZXIocGlwZSlcblxuICAgICAgYXdhaXQgcGlwZS5nX2luLmZlZWQgQFxuICAgICAgICBkZWxheV93YWxrIEAjIDE5NDIsIDIwNDIsIDIxNDJcblxuICAgICAgcGlwZS5zdG9wKClcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCBhd2FpdCB6LCBAW10gMTk0MiwgMjA0MiwgMjE0MlxuXG5cbiAgICBpdCBAICdiaW5kX3ZlYycsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSgpXG4gICAgICBsZXQgeiA9IGFvX2l0ZXIocGlwZSkubmV4dCgpXG4gICAgICBsZXQgc2VuZCA9IHBpcGUuZ19pbi5iaW5kX3ZlYyBAICdhJywgJ2InLCAnYydcbiAgICAgIHNlbmQoJ2JpbmRfdmVjJylcblxuICAgICAgeiA9IGF3YWl0IHpcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwgQCB6LnZhbHVlLFxuICAgICAgICBAW10gJ2EnLCAnYicsICdjJywgJ2JpbmRfdmVjJ1xuXG5cbiAgICBpdCBAICdiaW5kX29iaicsIEA6Oj5cbiAgICAgIGxldCBwaXBlID0gYW9fcGlwZSgpXG4gICAgICBsZXQgeiA9IGFvX2l0ZXIocGlwZSkubmV4dCgpXG4gICAgICBsZXQgc2VuZCA9IHBpcGUuZ19pbi5iaW5kX29iaiBAICd6ZWQnLCBAe31cbiAgICAgICAgYTogJ2FhYScsIGI6ICdiYmInXG5cbiAgICAgIHNlbmQoJ2JpbmRfb2JqJylcbiAgICAgIHogPSBhd2FpdCB6XG4gICAgICBhc3NlcnQuZGVlcEVxdWFsIEAgei52YWx1ZSxcbiAgICAgICAgQHt9IGE6J2FhYScsIGI6J2JiYicsIHplZDogJ2JpbmRfb2JqJ1xuXG5cbiAgZGVzY3JpYmUgQCAnb3V0cHV0IGFzeW5jIGdlbmVyYXRvcicsIEA6OlxuICAgIGl0IEAgJ3JhdycsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2dlbiBAXG4gICAgICAgIGFvX3BpcGUgQDpcbiAgICAgICAgICB4c3JjOiBkZWxheV93YWxrIEAjIDMwLDIwLDEwXG4gICAgICAgICAga2luZDogJ3JhdydcblxuICAgICAgbGV0IHYwID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcCA9IGFvX3J1bihncylcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5iZS51bmRlZmluZWRcblxuICAgICAgbGV0IHYxID0gZ3MubmV4dCgpXG4gICAgICBleHBlY3QodjEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBleHBlY3QoYXdhaXQgdjApLnRvLmRlZXAuZXF1YWwgQDogdmFsdWU6IDMwLCBkb25lOiBmYWxzZVxuICAgICAgZXhwZWN0KGF3YWl0IHYxKS50by5kZWVwLmVxdWFsIEA6IHZhbHVlOiB1bmRlZmluZWQsIGRvbmU6IHRydWVcblxuXG4gICAgaXQgQCAndGFwJywgQDo6PlxuICAgICAgbGV0IGdzID0gaXNfYXN5bmNfaXRlcmFibGUgQFxuICAgICAgICBhb19waXBlIEA6XG4gICAgICAgICAgeHNyYzogZGVsYXlfd2FsayBAIyAzMCwgMjAsIDEwXG4gICAgICAgICAga2luZDogJ3RhcCdcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuICAgICAgbGV0IGIgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MuYW9fZm9yaygpKVxuXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcbiAgICAgIGV4cGVjdChncy5mZW5jZSkudG8uYmUuYSgnZnVuY3Rpb24nKVxuXG4gICAgICBleHBlY3QoYSkudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoYikudG8uYmUuYSgncHJvbWlzZScpXG4gICAgICBleHBlY3QoeikudG8uYmUuYSgncHJvbWlzZScpXG5cbiAgICAgIGxldCBwID0gZ3MuZmVuY2UoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGF3YWl0IHApLnRvLmVxdWFsIEAgMzBcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGEpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuICAgICAgZXhwZWN0KGF3YWl0IGIpLnRvLmRlZXAuZXF1YWwgQCMgMzAsIDIwLCAxMFxuXG5cbiAgICBpdCBAICdzcGxpdCcsIEA6Oj5cbiAgICAgIGxldCBncyA9IGlzX2FzeW5jX2l0ZXJhYmxlIEBcbiAgICAgICAgYW9fcGlwZSBAOlxuICAgICAgICAgIHhzcmM6IGRlbGF5X3dhbGsgQCMgMzAsIDIwLCAxMFxuICAgICAgICAgIGtpbmQ6ICdzcGxpdCdcblxuICAgICAgbGV0IGEgPSBhcnJheV9mcm9tX2FvX2l0ZXIoZ3MpXG4gICAgICBsZXQgYiA9IGFycmF5X2Zyb21fYW9faXRlcihncy5hb19mb3JrKCkpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihncylcblxuICAgICAgZXhwZWN0KGdzLmZlbmNlKS50by5iZS5hKCdmdW5jdGlvbicpXG4gICAgICBleHBlY3QoZ3MuZmluKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgZXhwZWN0KGEpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KGIpLnRvLmJlLmEoJ3Byb21pc2UnKVxuICAgICAgZXhwZWN0KHopLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQgcCA9IGdzLmZlbmNlKClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcbiAgICAgIGV4cGVjdChhd2FpdCBwKS50by5lcXVhbCBAIDMwXG5cbiAgICAgIGV4cGVjdChhd2FpdCB6KS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBhKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcbiAgICAgIGV4cGVjdChhd2FpdCBiKS50by5kZWVwLmVxdWFsIEAjIDMwLCAyMCwgMTBcblxuIiwiaW1wb3J0IHthb19pbnRlcnZhbCwgYW9fdGltZW91dCwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAndGltZScsIEA6OlxuICBpdCBAICdzaGFwZScsIEA6OlxuICAgIGlzX2ZuIEAgYW9faW50ZXJ2YWxcbiAgICBpc19mbiBAIGFvX3RpbWVvdXRcbiAgICBpc19mbiBAIGFvX3RpbWVzXG5cbiAgaXQgQCAnYW9faW50ZXJ2YWwnLCBAOjo+XG4gICAgbGV0IGFvdCA9IGlzX2FzeW5jX2l0ZXJhYmxlIEAgYW9faW50ZXJ2YWwoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuICBpdCBAICdhb190aW1lb3V0JywgQDo6PlxuICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX3RpbWVvdXQoMTApXG4gICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgIHRyeSA6OlxuICAgICAgbGV0IHAgPSBnLm5leHQoKVxuICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICBsZXQge3ZhbHVlfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydC5lcXVhbCgxLCB2YWx1ZSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcblxuICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICBsZXQgZyA9IGlzX2dlbiBAIGFvX3RpbWVzIEAgYW9faW50ZXJ2YWwoMTApXG5cbiAgICB0cnkgOjpcbiAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgIGV4cGVjdChwKS50by5iZS5hKCdwcm9taXNlJylcblxuICAgICAgbGV0IHt2YWx1ZTogdHMxfSA9IGF3YWl0IHBcbiAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgbGV0IHt2YWx1ZTogdHMyfSA9IGF3YWl0IGcubmV4dCgpXG4gICAgICBhc3NlcnQodHMyID49IHRzMSlcblxuICAgIGZpbmFsbHkgOjpcbiAgICAgIGcucmV0dXJuKClcbiIsImltcG9ydCB7YW9fcGlwZSwgYW9fZG9tX2V2ZW50c30gZnJvbSAncm9hcCdcblxuaW1wb3J0IEB7fVxuICBhc3NlcnQsIGV4cGVjdCxcbiAgZGVsYXksXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG4gIGFycmF5X2Zyb21fYW9faXRlclxuZnJvbSAnLi9fdXRpbHMuanN5J1xuXG5cbmRlc2NyaWJlIEAgJ2RvbSBldmVudHMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9ldmVudHNcblxuICAgIGxldCBkZSA9IGFvX2RvbV9ldmVudHMoYW9fcGlwZSgpKVxuICAgIGlzX2ZuIEAgZGUubGlzdGVuXG4gICAgaXNfZm4gQCBkZS5yZW1vdmVcbiAgICBpc19mbiBAIGRlLnNldF9pbmZvXG4gICAgaXNfZm4gQCBkZS53aXRoXG5cbiAgaWYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCA6OlxuXG4gICAgaXQgQCAnbWVzc2FnZSBjaGFubmVscycsIEA6Oj5cbiAgICAgIGNvbnN0IHtwb3J0MSwgcG9ydDJ9ID0gbmV3IE1lc3NhZ2VDaGFubmVsKClcblxuICAgICAgY29uc3QgYW9fdGd0ID0gYW9fcGlwZSgpXG4gICAgICBsZXQgeiA9IGFycmF5X2Zyb21fYW9faXRlcihhb190Z3QpXG5cbiAgICAgIGFvX2RvbV9ldmVudHMoYW9fdGd0KS53aXRoIEA6XG4gICAgICAgICQ6IEB7fSB0ZXN0X25hbWU6IHBvcnQyXG4gICAgICAgIG1lc3NhZ2U6IGV2dCA9PiBldnQuZGF0YVxuXG4gICAgICA6OiE+XG4gICAgICAgIGZvciBsZXQgbSBvZiBbJ2EnLCAnYicsICdjJ10gOjpcbiAgICAgICAgICBwb3J0MS5wb3N0TWVzc2FnZSBAIGBmcm9tIG1zZyBwb3J0MTogJHttfWBcbiAgICAgICAgICBhd2FpdCBkZWxheSgxKVxuXG4gICAgICAgIGFvX3RndC5nX2luLnN0b3AoKVxuXG5cbiAgICAgIGxldCBleHBlY3RlZCA9IEBbXVxuICAgICAgICBAe30gZG9tX2l0ZW06ICdNZXNzYWdlUG9ydCdcbiAgICAgICAgICAgIGV2dDogJ21lc3NhZ2UnXG4gICAgICAgICAgICBrOiAndGVzdF9uYW1lJ1xuICAgICAgICAgICAgdjogJ2Zyb20gbXNnIHBvcnQxOiBhJ1xuXG4gICAgICAgIEB7fSBkb21faXRlbTogJ01lc3NhZ2VQb3J0J1xuICAgICAgICAgICAgZXZ0OiAnbWVzc2FnZSdcbiAgICAgICAgICAgIGs6ICd0ZXN0X25hbWUnXG4gICAgICAgICAgICB2OiAnZnJvbSBtc2cgcG9ydDE6IGInXG5cbiAgICAgICAgQHt9IGRvbV9pdGVtOiAnTWVzc2FnZVBvcnQnXG4gICAgICAgICAgICBldnQ6ICdtZXNzYWdlJ1xuICAgICAgICAgICAgazogJ3Rlc3RfbmFtZSdcbiAgICAgICAgICAgIHY6ICdmcm9tIG1zZyBwb3J0MTogYydcblxuICAgICAgZXhwZWN0KGF3YWl0IHopLnRvLmRlZXAuZXF1YWwoZXhwZWN0ZWQpXG5cbiIsImltcG9ydCB7YW9fZG9tX2FuaW1hdGlvbiwgYW9fdGltZXMsIGFvX2l0ZXJ9IGZyb20gJ3JvYXAnXG5cbmltcG9ydCBAe31cbiAgYXNzZXJ0LCBleHBlY3QsXG4gIGlzX2dlbiwgaXNfZm4sIGlzX2FzeW5jX2l0ZXJhYmxlXG5mcm9tICcuL191dGlscy5qc3knXG5cblxuZGVzY3JpYmUgQCAnZG9tIGFuaW1hdGlvbiBmcmFtZXMnLCBAOjpcbiAgaXQgQCAnc2hhcGUnLCBAOjpcbiAgICBpc19mbiBAIGFvX2RvbV9hbmltYXRpb25cblxuICBpZiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHJlcXVlc3RBbmltYXRpb25GcmFtZSA6OlxuXG4gICAgaXQgQCAnYW9fZG9tX2FuaW1hdGlvbicsIEA6Oj5cbiAgICAgIGxldCBhb3QgPSBpc19hc3luY19pdGVyYWJsZSBAIGFvX2RvbV9hbmltYXRpb24oKVxuICAgICAgbGV0IGcgPSBhb19pdGVyKGFvdClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWV9ID0gYXdhaXQgcFxuICAgICAgICBhc3NlcnQodmFsdWUgPj0gMClcblxuICAgICAgZmluYWxseSA6OlxuICAgICAgICBnLnJldHVybigpXG5cbiAgICBpdCBAICdhb190aW1lcycsIEA6Oj5cbiAgICAgIGxldCBnID0gaXNfZ2VuIEAgYW9fdGltZXMgQCBhb19kb21fYW5pbWF0aW9uKClcblxuICAgICAgdHJ5IDo6XG4gICAgICAgIGxldCBwID0gZy5uZXh0KClcbiAgICAgICAgZXhwZWN0KHApLnRvLmJlLmEoJ3Byb21pc2UnKVxuXG4gICAgICAgIGxldCB7dmFsdWU6IHRzMX0gPSBhd2FpdCBwXG4gICAgICAgIGFzc2VydCh0czEgPj0gMClcblxuICAgICAgICBsZXQge3ZhbHVlOiB0czJ9ID0gYXdhaXQgZy5uZXh0KClcbiAgICAgICAgYXNzZXJ0KHRzMiA+PSB0czEpXG5cbiAgICAgIGZpbmFsbHkgOjpcbiAgICAgICAgZy5yZXR1cm4oKVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztFQUFBLG1DQUFtQyxNQUFNOzs7SUFJdkMsWUFBYTtNQUNYLFdBQVksT0FBUTs7O0lBR3RCLGNBQWU7OztJQUdmO2VBQ1M7TUFDUDtNQUNBOzs7SUFHRixhQUFjLFVBQVc7SUFDekI7OztJQUdBO0lBQ0E7SUFDQTtJQUNBOzs7SUFHQSxPQUFRLGlDQUFrQztJQUMxQzs7O0lBR0E7ZUFDUztNQUNQO0lBQ0Y7O0VDbENGLE1BQU07RUFDTixFQUFFLE1BQU0sRUFBRSxXQUFXO0VBQ3JCLEVBQUUsZ0JBQWdCLEVBQUUsVUFBVTtFQUM5QixDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQ1g7RUFDQSxNQUFNO0VBQ04sRUFBRSxPQUFPLEVBQUUsU0FBUztFQUNwQixDQUFDLEdBQUcsS0FBSyxDQUFDO0FBQ1Y7RUFDQSxNQUFNLFVB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
