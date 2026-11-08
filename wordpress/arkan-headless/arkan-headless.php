<?php
/**
 * Plugin Name: Arkan Gold — مجله هدلس
 * Description: وردپرس را به پنل محتوای مجله‌ی آرکان گلد تبدیل می‌کند: بازدید از صفحه‌های عمومی وردپرس به همان آدرس در arkan.gold/mag هدایت می‌شود و با هر انتشار/ویرایش مطلب، کش صفحه‌های مجله روی سرور Node.js پاک می‌شود تا تغییر فوراً دیده شود.
 * Version:     2.3.0
 * Author:      Arkan Gold
 * Requires PHP: 7.4
 *
 * نصب: پوشه‌ی arkan-headless را در wp-content/plugins کپی و افزونه را فعال کنید.
 * تنظیمات: پیشخوان ← تنظیمات ← مجله هدلس
 *
 * می‌توانید به‌جای صفحه‌ی تنظیمات، مقادیر را در wp-config.php تعریف کنید (اولویت دارند و امن‌ترند):
 *   define('ARKAN_FRONTEND_URL', 'https://arkan.gold/mag');
 *   define('ARKAN_REVALIDATE_TOKEN', '...');   // همان MAG_REVALIDATE_TOKEN برنامه‌ی Node.js
 */

if (!defined('ABSPATH')) {
    exit;
}

const ARKAN_HEADLESS_OPTION = 'arkan_headless';

/* ------------------------------------------------------------------
 * تنظیمات
 * ------------------------------------------------------------------ */

function arkan_headless_settings()
{
    $saved = get_option(ARKAN_HEADLESS_OPTION, []);
    $settings = wp_parse_args(is_array($saved) ? $saved : [], [
        'frontend_url'     => 'https://arkan.gold/mag',
        'redirect'         => '1',
        'revalidate_token' => '',
    ]);
    $constants = [
        'frontend_url'     => 'ARKAN_FRONTEND_URL',
        'revalidate_token' => 'ARKAN_REVALIDATE_TOKEN',
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

/* ------------------------------------------------------------------
 * cms.arkan.gold نباید در نتایج جست‌وجو بیاید
 *   - صفحه‌های عمومی با ۳۰۱ به arkan.gold/mag می‌روند (بالا)
 *   - همه‌ی پاسخ‌های وردپرس (API، ورود، پیشخوان، پیش‌نمایش، sitemap افزونه‌ی سئو) هدر noindex دارند
 *   - sitemap خود وردپرس خاموش است (sitemap مجله: https://arkan.gold/mag/sitemap.xml)
 *   فایل‌های wp-content/uploads را خود وب‌سرور سرو می‌کند؛ برای آن‌ها قطعه‌ی .htaccess در README
 *   (بخش مجله) را به cms اضافه کنید. سایت اصلی تصاویر را با آدرس arkan.gold سرو می‌کند.
 * ------------------------------------------------------------------ */

function arkan_headless_noindex_header()
{
    if (!headers_sent()) {
        header('X-Robots-Tag: noindex, nofollow', true);
    }
}
add_action('send_headers', 'arkan_headless_noindex_header');
add_action('login_init', 'arkan_headless_noindex_header');
add_action('admin_init', 'arkan_headless_noindex_header');

add_filter('rest_post_dispatch', function ($response) {
    if ($response instanceof WP_REST_Response) {
        $response->header('X-Robots-Tag', 'noindex, nofollow');
        // پاسخ‌های REST نباید در LiteSpeed Cache، کش افزونه‌ها یا CDN جلوی cms بمانند؛ وگرنه ویرایش مطلب
        // دیر روی arkan.gold دیده می‌شود (سایت اصلی خودش پاسخ‌ها را کش و بعد از انتشار پاک می‌کند)
        $response->header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        $response->header('X-LiteSpeed-Cache-Control', 'no-cache');
    }
    return $response;
});

add_filter('wp_sitemaps_enabled', '__return_false');

// «جلوگیری از ایندکس توسط موتورهای جست‌وجو» نباید روشن باشد: Yoast/Rank Math در این حالت همه‌ی
// مطالب را noindex اعلام می‌کنند و همین روی arkan.gold/mag هم اعمال می‌شود. cms با هدر بالا مخفی است.
add_action('admin_notices', function () {
    if (!current_user_can('manage_options') || get_option('blog_public') !== '0') {
        return;
    }
    echo '<div class="notice notice-error"><p><strong>مجله آرکان گلد:</strong> گزینه‌ی «جلوگیری از ایندکس توسط موتورهای جست‌وجو» در '
        . '<a href="' . esc_url(admin_url('options-reading.php')) . '">تنظیمات ← خواندن</a> روشن است. '
        . 'آن را خاموش کنید؛ وگرنه همه‌ی مطالب مجله روی arkan.gold هم از گوگل حذف می‌شوند. '
        . 'خود cms.arkan.gold با افزونه‌ی «مجله هدلس» از نتایج جست‌وجو مخفی است.</p></div>';
});

/* ------------------------------------------------------------------
 * سازگاری با Rank Math / Yoast برای سایت اصلی
 *   - فیلد arkan_noindex در REST (نوشته، برگه، دسته، برچسب، نویسنده): sitemap و صفحه‌های
 *     arkan.gold/mag صفحه‌های noindex را بدون درخواست جداگانه می‌شناسند
 *   - GET /wp-json/arkan/v1/redirects: ریدایرکت‌های فعال ماژول Redirections افزونه‌ی Rank Math تا
 *     همان ریدایرکت‌ها روی arkan.gold/mag هم اجرا شوند
 * ------------------------------------------------------------------ */

function arkan_headless_has_noindex($robots)
{
    if (is_string($robots)) {
        $robots = maybe_unserialize($robots);
    }
    return is_array($robots) && in_array('noindex', $robots, true);
}

function arkan_headless_post_noindex($post_id)
{
    try {
        if (class_exists('\RankMath\Helper') && method_exists('\RankMath\Helper', 'is_post_indexable')) {
            return !\RankMath\Helper::is_post_indexable($post_id);
        }
    } catch (\Throwable $e) {
        // نسخه‌های دیگر Rank Math: از متای مطلب
    }
    if (arkan_headless_has_noindex(get_post_meta($post_id, 'rank_math_robots', true))) {
        return true;
    }
    return get_post_meta($post_id, '_yoast_wpseo_meta-robots-noindex', true) === '1';
}

function arkan_headless_term_noindex($term_id, $taxonomy)
{
    try {
        if (class_exists('\RankMath\Helper') && method_exists('\RankMath\Helper', 'is_term_indexable')) {
            $term = get_term($term_id, $taxonomy);
            if ($term && !is_wp_error($term)) {
                return !\RankMath\Helper::is_term_indexable($term);
            }
        }
    } catch (\Throwable $e) {
        // از متای دسته/برچسب
    }
    return arkan_headless_has_noindex(get_term_meta($term_id, 'rank_math_robots', true));
}

add_action('rest_api_init', function () {
    $schema = ['type' => 'boolean', 'context' => ['view', 'embed'], 'readonly' => true];
    foreach (['post', 'page'] as $type) {
        register_rest_field($type, 'arkan_noindex', [
            'get_callback' => function ($obj) {
                return arkan_headless_post_noindex((int) $obj['id']);
            },
            'schema' => $schema,
        ]);
    }
    foreach (['category', 'post_tag'] as $type) {
        register_rest_field($type, 'arkan_noindex', [
            'get_callback' => function ($obj) {
                return arkan_headless_term_noindex((int) $obj['id'], (string) ($obj['taxonomy'] ?? ''));
            },
            'schema' => $schema,
        ]);
    }
    register_rest_field('user', 'arkan_noindex', [
        'get_callback' => function ($obj) {
            return arkan_headless_has_noindex(get_user_meta((int) $obj['id'], 'rank_math_robots', true));
        },
        'schema' => $schema,
    ]);

    register_rest_route('arkan/v1', '/redirects', [
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => function () {
            global $wpdb;
            $table = $wpdb->prefix . 'rank_math_redirections';
            if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table)) !== $table) {
                return rest_ensure_response([]);
            }
            $rows = $wpdb->get_results("SELECT sources, url_to, header_code FROM {$table} WHERE status = 'active' ORDER BY id ASC LIMIT 5000", ARRAY_A);
            $out = [];
            foreach ((array) $rows as $row) {
                $sources = maybe_unserialize($row['sources']);
                if (!is_array($sources)) {
                    continue;
                }
                $out[] = [
                    'sources' => array_values(array_map(function ($src) {
                        return [
                            'pattern'    => (string) ($src['pattern'] ?? ''),
                            'comparison' => (string) ($src['comparison'] ?? 'exact'),
                            'ignore'     => (string) ($src['ignore'] ?? ''),
                        ];
                    }, $sources)),
                    'to'      => (string) $row['url_to'],
                    'code'    => (int) $row['header_code'],
                ];
            }
            $response = rest_ensure_response($out);
            $response->header('Cache-Control', 'no-store');
            return $response;
        },
    ]);
});

/* ------------------------------------------------------------------
 * ۲) پاک کردن کش مجله بعد از هر تغییر محتوای عمومی
 *    POST {frontend_url}/wp-revalidate با هدر X-Revalidate-Token — صفحه‌ها در بازدید بعدی از نو
 *    ساخته می‌شوند. بدون این تنظیم هم تغییرات حداکثر بعد از ۲ دقیقه (عمر کش) دیده می‌شوند.
 * ------------------------------------------------------------------ */

function arkan_headless_queue_revalidate()
{
    static $queued = false;
    if ($queued || arkan_headless_settings()['revalidate_token'] === '') {
        return;
    }
    $queued = true;
    // یک درخواست در پایان همین درخواست (حتی اگر چند مطلب/دسته هم‌زمان تغییر کرده باشند)
    add_action('shutdown', 'arkan_headless_revalidate');
}

// انتشار، ویرایش مطلب منتشرشده، خارج کردن از انتشار، حذف و انتشار زمان‌بندی‌شده
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if (!in_array($post->post_type, ['post', 'page'], true) || wp_is_post_revision($post) || wp_is_post_autosave($post)) {
        return;
    }
    if ($new_status === 'publish' || $old_status === 'publish') {
        arkan_headless_queue_revalidate();
    }
}, 10, 3);

// تغییر دسته‌ها و برچسب‌ها (نام، توضیحات، نامک)
foreach (['created_term', 'edited_term', 'delete_term'] as $hook) {
    add_action($hook, function ($term_id, $tt_id, $taxonomy) {
        if (in_array($taxonomy, ['category', 'post_tag'], true)) {
            arkan_headless_queue_revalidate();
        }
    }, 10, 3);
}

// تغییر نام یا بیوگرافی نویسنده، و تغییر نام/توضیح سایت
add_action('profile_update', 'arkan_headless_queue_revalidate');
add_action('update_option_blogname', 'arkan_headless_queue_revalidate');
add_action('update_option_blogdescription', 'arkan_headless_queue_revalidate');

function arkan_headless_revalidate()
{
    $s = arkan_headless_settings();
    if ($s['revalidate_token'] === '' || $s['frontend_url'] === '') {
        return new WP_Error('not_configured', 'توکن پاک‌سازی کش تنظیم نشده است.');
    }
    // پاسخ ذخیره‌ی مطلب منتظر این درخواست نماند (PHP-FPM / LiteSpeed)
    if (doing_action('shutdown')) {
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } elseif (function_exists('litespeed_finish_request')) {
            litespeed_finish_request();
        }
    }
    $response = wp_remote_post($s['frontend_url'] . '/wp-revalidate', [
        'timeout' => 8,
        'headers' => ['X-Revalidate-Token' => $s['revalidate_token'], 'User-Agent' => 'ArkanHeadless/2.0'],
    ]);
    $result = is_wp_error($response)
        ? 'خطا: ' . $response->get_error_message()
        : 'HTTP ' . wp_remote_retrieve_response_code($response);
    update_option('arkan_headless_last_revalidate', ['time' => time(), 'result' => $result], false);
    return $response;
}

/* ------------------------------------------------------------------
 * ۳) صفحه‌ی تنظیمات: پیشخوان ← تنظیمات ← مجله هدلس
 * ------------------------------------------------------------------ */

add_action('admin_init', function () {
    register_setting('arkan_headless', ARKAN_HEADLESS_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => function ($input) {
            $input = is_array($input) ? $input : [];
            return [
                'frontend_url'     => esc_url_raw(trim((string) ($input['frontend_url'] ?? ''))),
                'redirect'         => empty($input['redirect']) ? '0' : '1',
                'revalidate_token' => sanitize_text_field((string) ($input['revalidate_token'] ?? '')),
            ];
        },
    ]);
});

add_action('admin_post_arkan_headless_revalidate_now', function () {
    if (!current_user_can('manage_options')) {
        wp_die('دسترسی ندارید.');
    }
    check_admin_referer('arkan_headless_revalidate_now');
    $response = arkan_headless_revalidate();
    $ok = !is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200;
    wp_safe_redirect(add_query_arg('arkan_revalidate', $ok ? 'ok' : 'failed', admin_url('options-general.php?page=arkan-headless')));
    exit;
});

add_action('admin_menu', function () {
    add_options_page('مجله هدلس آرکان گلد', 'مجله هدلس', 'manage_options', 'arkan-headless', 'arkan_headless_settings_page');
});

function arkan_headless_settings_page()
{
    $s = arkan_headless_settings();
    $last = get_option('arkan_headless_last_revalidate');
    $name = ARKAN_HEADLESS_OPTION;
    $locked = function ($constant) {
        return defined($constant) ? ' disabled title="در wp-config.php تعریف شده است"' : '';
    };
    $status = isset($_GET['arkan_revalidate']) ? sanitize_key($_GET['arkan_revalidate']) : '';
    ?>
    <div class="wrap">
        <h1>مجله هدلس آرکان گلد</h1>
        <?php if ($status !== '') : ?>
            <div class="notice notice-<?php echo $status === 'ok' ? 'success' : 'error'; ?>"><p>
                <?php echo $status === 'ok' ? 'کش مجله پاک شد؛ صفحه‌ها در بازدید بعدی از نو ساخته می‌شوند.' : 'پاک کردن کش ناموفق بود؛ نتیجه را پایین صفحه ببینید.'; ?>
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
                    <th scope="row"><label for="ah-token">توکن پاک‌سازی کش</label></th>
                    <td><input id="ah-token" type="password" class="regular-text code" dir="ltr" autocomplete="off" name="<?php echo esc_attr($name); ?>[revalidate_token]" value="<?php echo esc_attr($s['revalidate_token']); ?>"<?php echo $locked('ARKAN_REVALIDATE_TOKEN'); ?>>
                        <p class="description">همان مقدار متغیر <code dir="ltr">MAG_REVALIDATE_TOKEN</code> در برنامه‌ی Node.js (حداقل ۱۶ کاراکتر). با هر انتشار یا ویرایش مطلب، کش صفحه‌های مجله پاک می‌شود.</p></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <h2>پاک کردن دستی کش</h2>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="arkan_headless_revalidate_now">
            <?php wp_nonce_field('arkan_headless_revalidate_now'); ?>
            <?php submit_button('پاک کردن کش مجله', 'secondary', 'submit', false, $s['revalidate_token'] === '' ? ['disabled' => 'disabled'] : []); ?>
        </form>
        <?php if (is_array($last)) : ?>
            <p>آخرین درخواست: <?php echo esc_html(wp_date('Y/m/d H:i', (int) $last['time'])); ?> — <code dir="ltr"><?php echo esc_html($last['result']); ?></code></p>
        <?php endif; ?>
    </div>
    <?php
}
