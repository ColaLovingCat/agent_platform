namespace AesFormsApp
{
    partial class Main
    {
        /// <summary>
        ///  Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        ///  Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        ///  Required method for Designer support - do not modify
        ///  the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            txt_top = new TextBox();
            txt_bottom = new TextBox();
            btn_aes = new Button();
            btn_des = new Button();
            SuspendLayout();
            // 
            // txt_top
            // 
            txt_top.Font = new Font("Microsoft YaHei UI", 16F);
            txt_top.Location = new Point(17, 21);
            txt_top.Multiline = true;
            txt_top.Name = "txt_top";
            txt_top.Size = new Size(561, 84);
            txt_top.TabIndex = 0;
            // 
            // txt_bottom
            // 
            txt_bottom.Font = new Font("Microsoft YaHei UI", 16F);
            txt_bottom.Location = new Point(17, 220);
            txt_bottom.Multiline = true;
            txt_bottom.Name = "txt_bottom";
            txt_bottom.Size = new Size(561, 84);
            txt_bottom.TabIndex = 1;
            // 
            // btn_aes
            // 
            btn_aes.Font = new Font("Microsoft YaHei UI", 18F);
            btn_aes.Location = new Point(75, 145);
            btn_aes.Name = "btn_aes";
            btn_aes.Size = new Size(122, 39);
            btn_aes.TabIndex = 3;
            btn_aes.Text = "AES";
            btn_aes.UseVisualStyleBackColor = true;
            // 
            // btn_des
            // 
            btn_des.Font = new Font("Microsoft YaHei UI", 18F);
            btn_des.Location = new Point(370, 145);
            btn_des.Name = "btn_des";
            btn_des.Size = new Size(122, 39);
            btn_des.TabIndex = 4;
            btn_des.Text = "DES";
            btn_des.UseVisualStyleBackColor = true;
            // 
            // Main
            // 
            AutoScaleDimensions = new SizeF(7F, 17F);
            AutoScaleMode = AutoScaleMode.Font;
            ClientSize = new Size(596, 334);
            Controls.Add(btn_des);
            Controls.Add(btn_aes);
            Controls.Add(txt_bottom);
            Controls.Add(txt_top);
            Name = "Main";
            Text = "Main";
            ResumeLayout(false);
            PerformLayout();
        }

        #endregion

        private TextBox txt_top;
        private TextBox txt_bottom;
        private Button btn_aes;
        private Button btn_des;
    }
}
