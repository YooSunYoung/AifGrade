# python calculate.py label.csv prediction.csv
# private score 
import os
import sys
import pandas as pd
import numpy as np
from sklearn.metrics import f1_score

# load values
answer_file = os.path.join(sys.argv[1], "answer.csv")
y_true = pd.read_csv(answer_file, header=None, encoding='utf8').to_numpy()
y_pred = pd.read_csv(sys.argv[2], header=None, encoding='utf8').to_numpy()

# get scores
score = np.round(f1_score(y_true, y_pred, average='macro'), 7)

print("score:", score)
