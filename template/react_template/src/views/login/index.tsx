import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Form, Input } from 'antd';

import { useSystemStore } from '@/commons/stores/systems';
import { useLoadingStore } from '@/commons/stores/loading';

import eventBus from '@/commons/utils/eventBus';

import * as extend from '@/commons/utils/extends';
import * as messages from '@/commons/utils/messages';
import { logger } from '@/commons/utils/logger'
const log = logger.create("Login");

import * as current from '@/services/login.services';
import * as users from '@/services/users.services';

import styles from './index.module.scss';

const ACTIVE_DYNAMIC = false;
const CIRCLE_COLORS = ['#836fff', '#15f5ba', '#692ff'];

interface Circle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radius: number;
  color: string;
}

interface LoginForm {
  account: string;
  password: string;
  remember: boolean;
}

interface RegisterForm {
  userno: string;
  ntAccount: string;
  username: string;
  department: string;
  email: string;
  password: string;
  confirm: string;
}

export default function LoginView() {
  const { t } = useTranslation();
  const systemInfo = useSystemStore((state) => state.systemInfo);
  const setSiderShow = useSystemStore((state) => state.setSiderShow);
  const { startLoading, endLoading } = useLoadingStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const circlesRef = useRef<Circle[]>([]);
  const animationRef = useRef<number>(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [pageType, setPageType] = useState('');
  const [pagePath, setPagePath] = useState('');
  const [loginForm] = Form.useForm<LoginForm>();
  const [registerForm] = Form.useForm<RegisterForm>();

  const drawCircle = useCallback((circle: Circle) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = circle.color;
    ctx.fill();
    ctx.closePath();
  }, []);

  const initialCircle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const circleCount = Math.floor(window.innerWidth / 100);
    circlesRef.current = [];
    for (let i = 0; i < circleCount; i++) {
      const radius = window.innerWidth / 4;
      const x = extend.ExNumber.createRand(radius, canvas.width - radius);
      const y = extend.ExNumber.createRand(radius, canvas.height - radius);
      const dx = extend.ExNumber.createRand(window.innerWidth / -2000, window.innerWidth / 2000);
      const dy = extend.ExNumber.createRand(window.innerWidth / -2000, window.innerWidth / 2000);
      const color = CIRCLE_COLORS[Math.floor(Math.random() * CIRCLE_COLORS.length)];
      circlesRef.current.push({ x, y, dx, dy, radius, color });
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    circlesRef.current.forEach((circle) => {
      if (circle.x + circle.radius > canvas.width || circle.x - circle.radius < 0) {
        circle.dx = -circle.dx;
      }
      if (circle.y + circle.radius > canvas.height || circle.y - circle.radius < 0) {
        circle.dy = -circle.dy;
      }
      circle.x += circle.dx;
      circle.y += circle.dy;
      drawCircle(circle);
    });
    animationRef.current = requestAnimationFrame(animate);
  }, [drawCircle]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth * 1.5;
    canvas.height = window.innerHeight * 1.5;
    initialCircle();
  }, [initialCircle]);

  const loginSSO = useCallback(() => {
    if (!systemInfo) return;
    const redirect_uri = `${extend.ExWeb.url().server}/sso-auth`;
    const { host, client_id, scope, response_type } = systemInfo.azureConfigs;
    const params: Record<string, string> = {
      client_id,
      scope,
      response_type,
      redirect_uri,
      state: '',
    };
    if (pageType === 'jump') {
      params.state = encodeURIComponent(btoa(pagePath));
    }
    const url = `${host}?${extend.ExObject.stringifyParams(params)}`;
    window.open(url, '_self');
  }, [systemInfo, pageType, pagePath]);

  const handleLogin = useCallback(
    (values: LoginForm) => {
      if (!systemInfo) return;
      startLoading();
      extend.ExLocalStore.set(
        'remember',
        JSON.stringify({
          remember: values.remember,
          account: values.account,
        }),
      );

      const onSuccess = (resp: any) => {
        endLoading();
        const { status, message } = resp;
        if (status) {
          log.log('login', 'success')
          setSiderShow(true);
          //
          eventBus.emit('getinfosUser');
          eventBus.emit('jumpHome');
        } else {
          messages.showError(message);
        }
      };

      const onError = (err: unknown) => {
        endLoading();
        messages.showError(err);
      };

      const params = { account: values.account, password: values.password };
      switch (systemInfo.loginMode) {
        case 'sso-local':
          current.login(params).then(onSuccess, onError);
          break;
        case 'sso-iuser':
          current.loginiUser(params).then(onSuccess, onError);
          break;
        default:
          endLoading();
          break;
      }
    },
    [startLoading, endLoading, systemInfo],
  );

  const handleRegister = useCallback(
    async (values: RegisterForm) => {
      const valid = current.checkPassword(values.password, values.confirm);
      if (valid === -1) {
        messages.showError(t('message.password.notmatch'));
        return;
      }
      if (valid === -2) {
        messages.showError(t('message.password.notcom'));
        return;
      }

      const { department, confirm: _confirm, ...rest } = values;
      const params = {
        ...rest,
        deptName: department,
        id: '',
        status: 1,
        avatar: '',
        roleIDs: [] as string[],
      };
      const resp = await users.saveUser(params);
      if (resp.status) {
        setIsLogin(true);
      }
    },
    [t],
  );

  useEffect(() => {
    setSiderShow(false);

    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      if (ACTIVE_DYNAMIC) {
        animate();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        loginForm.submit();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    try {
      const remember = JSON.parse(extend.ExLocalStore.get('remember') || '{}') as {
        remember?: boolean;
        account?: string;
      };
      if (remember?.remember) {
        loginForm.setFieldsValue({
          account: remember.account ?? '',
          remember: remember.remember,
        });
      }
    } catch {
      // ignore invalid remember data
    }

    const params = extend.ExWeb.params();
    setPageType(params.type ?? '');
    if (params.type === 'logout') {
      eventBus.emit('clearSystem');
    } else if (params.type === 'jump') {
      setPagePath(params.path ?? '');
      loginSSO();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, loginForm, loginSSO, resizeCanvas, setSiderShow]);

  if (!systemInfo) return null;

  return (
    <div className={styles.contents}>
      <div className={styles.boxContents}>
        <div className={styles.colLeft}>
          <div className={styles.boxImg}>
            <div className={styles.loginTitles}>
              <p>
                Login to <br />
                Open the World
              </p>
            </div>
          </div>
          <div className={styles.bgImg} />
        </div>

        <div className={styles.colRight}>
          <div className={styles.boxLogin}>
            <div className={styles.titles}>{systemInfo.name}</div>

            {systemInfo.loginMode === 'sso-only' ? (
              <div className={styles.boxSso}>
                <p className={styles.titleSecond}>- Login only works from Bosch network -</p>
                <Button type="primary" className={`${styles.btn} ${styles.btnSso}`} onClick={loginSSO}>
                  <i className="fa-solid fa-cloud" />
                  <span>{t('btn.sso')}</span>
                </Button>
              </div>
            ) : (
              <div>
                {isLogin ? (
                  <div className={styles.fadeSlideEnter} key="login">
                    <Form
                      form={loginForm}
                      layout="vertical"
                      name="basic"
                      autoComplete="off"
                      onFinish={handleLogin}
                      initialValues={{ account: '', password: '', remember: false }}
                    >
                      <Form.Item
                        label={t('form.account')}
                        name="account"
                        rules={[{ required: true, message: 'Please input your account!' }]}
                      >
                        <Input />
                      </Form.Item>

                      <Form.Item
                        label={t('form.password')}
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                      >
                        <Input.Password />
                      </Form.Item>

                      <div className={styles.formFooterActions}>
                        <Form.Item name="remember" valuePropName="checked" noStyle>
                          <Checkbox className={styles.btnCheck}>{t('login.remember')}</Checkbox>
                        </Form.Item>
                        <a className={styles.switchBtn} onClick={() => setIsLogin(false)}>
                          {t('login.create')} &gt;&gt;
                        </a>
                      </div>

                      <Form.Item>
                        <Button type="primary" htmlType="submit" className={`${styles.btn} ${styles.btnLogin}`}>
                          {t('btn.login')}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                ) : (
                  <div className={styles.fadeSlideEnter} key="register">
                    <div className={styles.subTitle}>{t('login.create')}</div>
                    <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
                      <Form.Item name="userno" rules={[{ required: true, message: 'Please input your userno!' }]}>
                        <Input
                          placeholder="User No"
                          prefix={<i className="fa-solid fa-circle-user" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="ntAccount" rules={[{ required: true, message: 'Please input your account!' }]}>
                        <Input
                          placeholder="NT Account"
                          prefix={<i className="fa-solid fa-circle-user" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="username" rules={[{ required: true, message: 'Please input your username!' }]}>
                        <Input
                          placeholder="User Name"
                          prefix={<i className="fa-solid fa-user" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="department" rules={[{ required: true, message: 'Please input your department!' }]}>
                        <Input
                          placeholder="Department"
                          prefix={<i className="fa-solid fa-briefcase" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="email">
                        <Input
                          placeholder="Email"
                          prefix={<i className="fa-solid fa-at" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="password" rules={[{ required: true, message: 'Please input password!' }]}>
                        <Input.Password
                          placeholder="Password"
                          prefix={<i className="fa-solid fa-lock" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <Form.Item name="confirm" rules={[{ required: true, message: 'Please confirm password!' }]}>
                        <Input.Password
                          placeholder="Confirm Password"
                          prefix={<i className="fa-solid fa-lock" style={{ color: '#ccc' }} />}
                        />
                      </Form.Item>

                      <div className={styles.formFooterActions}>
                        <span>{t('login.already')}</span>
                        <a className={styles.switchBtn} onClick={() => setIsLogin(true)}>
                          &lt;&lt; {t('login.back')}
                        </a>
                      </div>

                      <Form.Item>
                        <Button type="primary" htmlType="submit" className={`${styles.btn} ${styles.btnRegister}`}>
                          {t('login.register')}
                        </Button>
                      </Form.Item>
                    </Form>
                  </div>
                )}

                {isLogin && (
                  <div className={styles.others}>
                    <div className={styles.lineDivider}>
                      <div className={styles.line} />
                      <span>{t('login.other')}</span>
                      <div className={styles.line} />
                    </div>
                    <div className={styles.btns}>
                      <Button type="primary" className={`${styles.btn} ${styles.btnSso}`} onClick={loginSSO}>
                        <i className="fa-solid fa-cloud" />
                        <span>{t('btn.sso')}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} width={500} height={500} />
      </div>
    </div>
  );
}
