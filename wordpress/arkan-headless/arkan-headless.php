<?php
/**
 * Plugin Name: Arkan Gold — مجله هدلس
 * Description: وردپرس را به پنل محتوای مجله‌ی آرکان گلد تبدیل می‌کند: بازدید از صفحه‌های عمومی وردپرس به همان آدرس در arkan.gold/mag هدایت می‌شود و با هر انتشار/ویرایش مطلب، build سایت از طریق یک Deploy Hook اجرا می‌شود.
 * Version:     1.0.0
 * Author:      Arkan Gold
 * Requires PHP: 7.4
 *
 * نصب: پوشه‌ی arkan-headless را در wp-content/plugins کپی و افزونه را فعال کنید.
 * تنظیمات: پیشخوان ← تنظیمات ← مجله هدلس
 *
 * می‌توانید به‌جای صفحه‌ی تنظیمات، مقادیر را در wp-config.php هم تعریف کنید (اولویت دارند):
 *   define('ARKAN_FRONTEND_URL', 'https://arkan.gold/mag');
 *   define('ARKAN_DEPLOY_HOOK_URL', 'https://api.github.com/repos/OWNER/REPO/dispatches');
 *   define('ARKAN_DEPLOY_HOOK_AUTH', 'Bearer github_pat_...');
 *   define('ARKAN_DEPLOY_HOOK_BODY', '{"event_type":"wordpress-publish"}');
 */

if (!defined('ABSPATH')) {
    exit;
}

const ARKAN_HEADLESS_OPTION = 'arkan_headless';
const ARKAN_HEADLESS_EVENT = 'arkan_headless_deploy';
/** فاصله‌ی تجمیع تغییرات پشت‌سرهم پیش از اجرای build (ثانیه) */
const ARKAN_HEADLESS_DEBOUNCE = 60;

/* ------------------------------------------------------------------
 * تنظیمات
 * ------------------------------------------------------------------ */

function arkan_headless_settings()
{
    $saved = get_option(ARKAN_HEADLESS_OPTION, []);
    $settings = wp_parse_args(is_array($saved) ? $saved : [], [
        'frontend_url' => 'https://arkan.gold/mag',
        'redirect'     => '1',
        'hook_url'     => '',
        'hook_auth'    => '',
        'hook_body'    => '',
    ]);
    $constants = [
        'frontend_url' => 'ARKAN_FRONTEND_URL',
        'hook_url'     => 'ARKAN_DEPLOY_HOOK_URL',
        'hook_auth'    => 'ARKAN_DEPLOY_HOOK_AUTH',
        'hook_body'    => 'ARKAN_DEPLOY_HOOK_BODY',
    ];
    foreach ($constants as $key => $constant) {
        if (defined($constant)) {
            $settings[$key] = (string) constant($constant);
        }
    }
    $settings['frontend_url'] = untrailingslashit($settings['frontend_url']);
    return $settings;
}

/* ------------------------------------------------------------------
 * ۱) هدایت صفحه‌های عمومی وردپرس به سایت اصلی
 *    https://cms.arkan.gold/قیمت-طلا/  ←  https://arkan.gold/mag/قیمت-طلا
 *    پیشخوان، REST API، ورود، پیش‌نمایش پیش‌نویس‌ها و فایل‌های آپلود دست‌نخورده می‌مانند.
 * ------------------------------------------------------------------ */

add_action('template_redirect', function () {
    $s = arkan_headless_settings();
    if ($s['redirect'] !== '1' || $s['frontend_url'] === '') {
        return;
    }
    if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
        return;
    }
    // پیش‌نمایش پیش‌نویس‌ها روی خود وردپرس نمایش داده می‌شود
    if (is_preview() || isset($_GET['preview']) || isset($_GET['preview_id']) || is_customize_preview() || is_robots()) {
        return;
    }

    $home = untrailingslashit(home_url());
    // اگر وردپرس هنوز روی همان آدرس مجله است (پیش از انتقال به ساب‌دامین)، هدایت باعث حلقه می‌شود
    if (strcasecmp(preg_replace('#^https?://#', '', $home), preg_replace('#^https?://#', '', $s['frontend_url'])) === 0) {
        return;
    }

    $home_path = (string) wp_parse_url($home, PHP_URL_PATH);
    $request = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/';
    $path = (string) wp_parse_url($request, PHP_URL_PATH);
    if ($home_path !== '' && strpos($path, $home_path) === 0) {
        $path = substr($path, strlen($home_path));
    }
    $path = trim($path, '/');

    $target = $s['frontend_url'] . ($path !== '' ? '/' . $path : '');
    $query = (string) wp_parse_url($request, PHP_URL_QUERY);
    if ($query !== '') {
        $target .= '?' . $query;
    }
    wp_redirect($target, 301, 'Arkan Headless');
    exit;
}, 1);

// پاسخ‌های REST API نباید در نتایج جست‌وجو بیایند
add_filter('rest_post_dispatch', function ($response) {
    if ($response instanceof WP_REST_Response) {
        $response->header('X-Robots-Tag', 'noindex, nofollow');
    }
    return $response;
});

/* ------------------------------------------------------------------
 * ۲) Deploy Hook — اجرای build سایت بعد از هر تغییر محتوای عمومی
 *    تغییرات پشت‌سرهم (مثلا ویرایش چند مطلب) با یک فاصله‌ی ۶۰ ثانیه‌ای در یک build تجمیع می‌شوند.
 * ------------------------------------------------------------------ */

function arkan_headless_schedule_deploy()
{
    if (arkan_headless_settings()['hook_url'] === '') {
        return;
    }
    if (!wp_next_scheduled(ARKAN_HEADLESS_EVENT)) {
        wp_schedule_single_event(time() + ARKAN_HEADLESS_DEBOUNCE, ARKAN_HEADLESS_EVENT);
    }
}

// انتشار، ویرایش مطلب منتشرشده، خارج کردن از انتشار، حذف و انتشار زمان‌بندی‌شده
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if (!in_array($post->post_type, ['post', 'page'], true) || wp_is_post_revision($post) || wp_is_post_autosave($post)) {
        return;
    }
    if ($new_status === 'publish' || $old_status === 'publish') {
        arkan_headless_schedule_deploy();
    }
}, 10, 3);

// تغییر دسته‌ها و برچسب‌ها (نام، توضیحات، نامک)
foreach (['edited_term', 'delete_term'] as $hook) {
    add_action($hook, function ($term_id, $tt_id, $taxonomy) {
        if (in_array($taxonomy, ['category', 'post_tag'], true)) {
            arkan_headless_schedule_deploy();
        }
    }, 10, 3);
}

// تغییر نام یا بیوگرافی نویسنده
add_action('profile_update', function ($user_id) {
    if (count_user_posts($user_id, 'post', true) > 0) {
        arkan_headless_schedule_deploy();
    }
});

function arkan_headless_trigger_deploy()
{
    $s = arkan_headless_settings();
    if ($s['hook_url'] === '') {
        return new WP_Error('no_hook', 'آدرس Deploy Hook تنظیم نشده است.');
    }
    $is_github = wp_parse_url($s['hook_url'], PHP_URL_HOST) === 'api.github.com';
    $headers = ['User-Agent' => 'ArkanHeadless/1.0', 'Accept' => $is_github ? 'application/vnd.github+json' : 'application/json'];
    if ($s['hook_auth'] !== '') {
        $headers['Authorization'] = $s['hook_auth'];
    }
    if ($s['hook_body'] !== '') {
        $headers['Content-Type'] = 'application/json';
    }
    $response = wp_remote_post($s['hook_url'], [
        'timeout' => 20,
        'headers' => $headers,
        'body'    => $s['hook_body'] !== '' ? $s['hook_body'] : null,
    ]);
    $result = is_wp_error($response)
        ? 'خطا: ' . $response->get_error_message()
        : 'HTTP ' . wp_remote_retrieve_response_code($response);
    update_option('arkan_headless_last_deploy', ['time' => time(), 'result' => $result], false);
    return $response;
}
add_action(ARKAN_HEADLESS_EVENT, 'arkan_headless_trigger_deploy');

/* ------------------------------------------------------------------
 * ۳) صفحه‌ی تنظیمات: پیشخوان ← تنظیمات ← مجله هدلس
 * ------------------------------------------------------------------ */

add_action('admin_init', function () {
    register_setting('arkan_headless', ARKAN_HEADLESS_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => function ($input) {
            $input = is_array($input) ? $input : [];
            $body = trim((string) ($input['hook_body'] ?? ''));
            if ($body !== '' && json_decode($body) === null) {
                add_settings_error(ARKAN_HEADLESS_OPTION, 'bad_json', 'بدنه‌ی درخواست باید JSON معتبر باشد؛ ذخیره نشد.');
                $body = '';
            }
            return [
                'frontend_url' => esc_url_raw(trim((string) ($input['frontend_url'] ?? ''))),
                'redirect'     => empty($input['redirect']) ? '0' : '1',
                'hook_url'     => esc_url_raw(trim((string) ($input['hook_url'] ?? ''))),
                'hook_auth'    => sanitize_text_field((string) ($input['hook_auth'] ?? '')),
                'hook_body'    => $body,
            ];
        },
    ]);
});

add_action('admin_post_arkan_headless_deploy_now', function () {
    if (!current_user_can('manage_options')) {
        wp_die('دسترسی ندارید.');
    }
    check_admin_referer('arkan_headless_deploy_now');
    $response = arkan_headless_trigger_deploy();
    $ok = !is_wp_error($response) && wp_remote_retrieve_response_code($response) < 300;
    wp_safe_redirect(add_query_arg('arkan_deploy', $ok ? 'ok' : 'failed', admin_url('options-general.php?page=arkan-headless')));
    exit;
});

add_action('admin_menu', function () {
    add_options_page('مجله هدلس آرکان گلد', 'مجله هدلس', 'manage_options', 'arkan-headless', 'arkan_headless_settings_page');
});

function arkan_headless_settings_page()
{
    $s = arkan_headless_settings();
    $last = get_option('arkan_headless_last_deploy');
    $name = ARKAN_HEADLESS_OPTION;
    $locked = function ($constant) {
        return defined($constant) ? ' disabled title="در wp-config.php تعریف شده است"' : '';
    };
    ?>
    <div class="wrap">
        <h1>مجله هدلس آرکان گلد</h1>
        <?php if (isset($_GET['arkan_deploy'])) : ?>
            <div class="notice notice-<?php echo $_GET['arkan_deploy'] === 'ok' ? 'success' : 'error'; ?>"><p>
                <?php echo $_GET['arkan_deploy'] === 'ok' ? 'درخواست build ارسال شد.' : 'ارسال درخواست build ناموفق بود؛ نتیجه را پایین صفحه ببینید.'; ?>
            </p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields('arkan_headless'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ah-frontend">آدرس مجله روی سایت اصلی</label></th>
                    <td><input id="ah-frontend" type="url" class="regular-text code" dir="ltr" name="<?php echo esc_attr($name); ?>[frontend_url]" value="<?php echo esc_attr($s['frontend_url']); ?>"<?php echo $locked('ARKAN_FRONTEND_URL'); ?>></td>
                </tr>
                <tr>
                    <th scope="row">هدایت صفحه‌های وردپرس</th>
                    <td><label><input type="checkbox" name="<?php echo esc_attr($name); ?>[redirect]" value="1" <?php checked($s['redirect'], '1'); ?>>
                        بازدید از صفحه‌های عمومی وردپرس به همان آدرس روی سایت اصلی هدایت شود (۳۰۱)</label></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ah-hook">آدرس Deploy Hook</label></th>
                    <td><input id="ah-hook" type="url" class="regular-text code" dir="ltr" name="<?php echo esc_attr($name); ?>[hook_url]" value="<?php echo esc_attr($s['hook_url']); ?>"<?php echo $locked('ARKAN_DEPLOY_HOOK_URL'); ?>>
                        <p class="description">بعد از هر انتشار یا ویرایش مطلب، یک درخواست POST به این آدرس فرستاده می‌شود تا سایت دوباره build شود.</p></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ah-auth">هدر Authorization (اختیاری)</label></th>
                    <td><input id="ah-auth" type="password" class="regular-text code" dir="ltr" autocomplete="off" name="<?php echo esc_attr($name); ?>[hook_auth]" value="<?php echo esc_attr($s['hook_auth']); ?>"<?php echo $locked('ARKAN_DEPLOY_HOOK_AUTH'); ?>>
                        <p class="description">مثلا <code dir="ltr">Bearer github_pat_...</code> برای GitHub Actions. امن‌تر است در wp-config.php تعریف شود.</p></td>
                </tr>
                <tr>
                    <th scope="row"><label for="ah-body">بدنه‌ی JSON (اختیاری)</label></th>
                    <td><textarea id="ah-body" class="large-text code" dir="ltr" rows="3" name="<?php echo esc_attr($name); ?>[hook_body]"<?php echo $locked('ARKAN_DEPLOY_HOOK_BODY'); ?>><?php echo esc_textarea($s['hook_body']); ?></textarea>
                        <p class="description">برای GitHub: <code dir="ltr">{"event_type":"wordpress-publish"}</code></p></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <h2>اجرای دستی build</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="arkan_headless_deploy_now">
            <?php wp_nonce_field('arkan_headless_deploy_now'); ?>
            <?php submit_button('اجرای build الان', 'secondary', 'submit', false, $s['hook_url'] === '' ? ['disabled' => 'disabled'] : []); ?>
        </form>
        <?php if (is_array($last)) : ?>
            <p>آخرین درخواست: <?php echo esc_html(wp_date('Y/m/d H:i', (int) $last['time'])); ?> — <code dir="ltr"><?php echo esc_html($last['result']); ?></code></p>
        <?php endif; ?>
        <?php if (wp_next_scheduled(ARKAN_HEADLESS_EVENT)) : ?>
            <p>یک build در صف اجرا است (حداکثر <?php echo (int) ARKAN_HEADLESS_DEBOUNCE; ?> ثانیه‌ی دیگر).</p>
        <?php endif; ?>
    </div>
    <?php
}
