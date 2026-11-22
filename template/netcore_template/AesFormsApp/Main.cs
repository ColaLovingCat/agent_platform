using CommonService.Core;
using CommonService.Core.Utils;

namespace AesFormsApp
{
    public partial class Main : Form
    {
        public Main()
        {
            InitializeComponent();

            btn_aes.Click += Btn_aes_Click;
            btn_des.Click += Btn_des_Click;
        }

        // º”√‹∞¥≈•
        private void Btn_aes_Click(object sender, EventArgs e)
        {
            try
            {
                var plainText = txt_top.Text;
                var cipher = AesEncryptionHelper.Encrypt(plainText);
                txt_bottom.Text = cipher;
            }
            catch (Exception ex)
            {
                MessageBox.Show($"º”√‹ ß∞‹: {ex.Message}");
            }
        }

        // Ω‚√‹∞¥≈•
        private void Btn_des_Click(object sender, EventArgs e)
        {
            try
            {
                var cipherText = txt_top.Text;
                var plain = AesEncryptionHelper.Decrypt(cipherText);
                txt_bottom.Text = plain;
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ω‚√‹ ß∞‹: {ex.Message}");
            }
        }
    }
}
